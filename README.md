# 早八签到系统 · 全栈入门指南

一个真实可用的学生/教师双端签到系统:签到码 + GPS 定位签到,支持补签、请假、审批、统计。
本 README 面向**新手**:逐文件讲清架构和功能,附学习路线和真实踩坑记录。

---

## 一、这是什么

- **学生端**:登录 → 加入课程 → 首页看到进行中签到(倒计时)→ 输码/定位签到 → 缺勤可 24h 内补签 → 可请假
- **教师端**:登录 → 创建课程(生成邀请码)→ 发起签到(签到码/定位)→ 实时看名单 → 审批补签/请假 → 看统计

架构上它是**单服务应用**:一个 Node.js 进程(Express)同时干两件事——
1. 提供 REST API(前端通过 `fetch` 调用)
2. 托管静态页面(浏览器访问 `http://localhost:3000` 直接拿到 `public/index.html`)

不需要 Vite、不需要前后端两个进程,一条 `npm start` 全起来。

## 二、技术栈(每项一句话)

| 层 | 技术 | 一句话说明 |
|---|---|---|
| 后端 | Node.js + Express | Node 是"在服务器上跑 JS"的运行时;Express 是最流行的 Node Web 框架 |
| 数据库 | MySQL 8+ | 关系型数据库,数据存在服务器上,7 张表 |
| 数据库驱动 | mysql2 | 让 Node 代码能连接并操作 MySQL 的库(连接池模式) |
| 密码加密 | bcryptjs | 密码加盐哈希,数据库里存的是密文,不是明文 |
| 登录鉴权 | jsonwebtoken (JWT) | 登录成功后发一张"电子凭证",之后每次请求带着它证明身份 |
| 前端 | Vue 3 + Vant 4(CDN 本地化) | Vue 管页面逻辑,Vant 提供移动端 UI 组件;不打包,浏览器直接跑 |
| 地图 | Leaflet | 教师发起定位签到时在地图上选中心点 |
| 测试 | 原生 fetch 脚本 + jsdom | smoke.js/e2e.js 用 Node 自带 fetch 测 API;jsdom 模拟浏览器测页面渲染 |

**核心依赖版本**(package.json):express ^5.1.0、mysql2 ^3.14.3、bcryptjs ^3.0.2、jsonwebtoken ^9.0.2

## 三、整体架构

```
手机/浏览器
   │  ① 打开 http://localhost:3000
   ▼
public/index.html (Vue3 + Vant 单页)
   │  ② fetch('/api/xxx', { headers: { Authorization: 'Bearer <JWT>' } })
   ▼
server.js (Express)
   │  ③ auth.js 中间件校验 JWT → 拿到 { id, name, role }
   │  ④ 业务逻辑(校验签到码/距离/时间窗/请假拦截…)
   ▼
db.js (mysql2 连接池) ──► MySQL (zaoba_signin 库, 7 张表)
```

一条请求的生命周期:

```
点击"签到" → 前端 doSign() → fetch POST /api/signin-tasks/1/sign
→ Express 路由命中 → auth 中间件验证 token → 业务校验(码对不对/超时没/请没请假)
→ 通过:db.q() 执行 INSERT 写入 signin_records → 返回 JSON → 前端弹"签到成功"
```

## 四、快速启动

```powershell
cd C:\Users\zms15\Downloads\早八签到
npm install     # 首次:装依赖到 node_modules
npm run seed    # 建库建表 + 灌演示数据(可重复执行,会清空数据)
npm start       # 启动服务,浏览器打开 http://localhost:3000
```

演示账号(密码都是 `123456`):教师 `t001`;学生 `s001` ~ `s0010`。

`.env` 存数据库密码等敏感配置(已被 .gitignore 忽略,不会提交到 git)。`npm start` 里的 `--env-file=.env` 就是让 Node 启动时自动把 .env 读成环境变量。

## 五、数据库设计(7 张表)

库名 `zaoba_signin`。建表语句在 `db.js` 的 `createTables()`,幂等(IF NOT EXISTS,重复执行不报错)。

### 1. users — 用户(学生+教师)
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT 自增主键 | 每张表都有 |
| account | VARCHAR(50) UNIQUE | 学号/工号,登录账号,唯一 |
| name | VARCHAR(50) | 姓名 |
| role | ENUM('student','teacher') | 角色,决定进哪个端 |
| password_hash | VARCHAR(100) | bcrypt 哈希后的密码,**不存明文** |
| created_at | DATETIME | 注册时间 |

### 2. courses — 课程
| 字段 | 说明 |
|---|---|
| name | 课程名 |
| teacher_id | 授课教师(关联 users.id) |
| invite_code | 6 位邀请码,UNIQUE,学生凭它加入 |

### 3. enrollments — 选课关系(学生 ↔ 课程)
| 字段 | 说明 |
|---|---|
| course_id + student_id | 联合唯一,防止重复加入 |

### 4. signin_tasks — 签到任务(教师发起的每次签到)
| 字段 | 说明 |
|---|---|
| course_id | 属于哪个课程 |
| type | 'code'(签到码)或 'location'(定位) |
| code | 6 位数字签到码(仅 code 类型用) |
| center_lat / center_lng / radius_m | 定位中心点+半径(仅 location 类型用) |
| start_time / end_time | 签到时间窗 |
| status | 'active' 进行中 / 'ended' 已结束 |
| ended_at | 实际结束时间(提前结束或到期时写入) |

### 5. signin_records — 签到记录(每个学生对每个任务一条)
| 字段 | 说明 |
|---|---|
| task_id + student_id | 联合唯一:同一任务每人只能有一条 |
| sign_time | 签到时间(补签通过/请假时可为 NULL) |
| status | normal / appeal_pending / appeal_approved / appeal_rejected / leave |
| lat / lng | 定位签到时的坐标 |

### 6. appeals — 补签申请
| 字段 | 说明 |
|---|---|
| task_id + student_id | 联合唯一:同任务只能申请一次 |
| reason / status / teacher_comment / reviewed_at | 理由、状态、教师意见、审批时间 |

### 7. leave_requests — 请假申请
| 字段 | 说明 |
|---|---|
| course_id + student_id + 时间段 | 一次请假覆盖一个时间段 |
| leave_type | sick 病假 / personal 事假 / other |
| start_time / end_time | 请假时段 |
| status / teacher_comment / reviewed_at | 同补签 |

> 没有建外键约束,表之间靠 id 逻辑关联(新手项目够用,出错了也好修)。

## 六、后端文件逐个讲

### 1. `.env` — 环境变量(不提交 git)
```
DB_HOST=127.0.0.1   # 数据库地址
DB_USER=root        # 数据库账号
DB_PASSWORD=xxx     # 数据库密码
DB_NAME=zaoba_signin
JWT_SECRET=xxx      # 签发 JWT 的密钥,泄露了别人就能伪造登录
PORT=3000
```

### 2. `config.js` — 统一配置出口
把 `process.env.xxx` 读出来组装成一个 config 对象,全项目 `require('./config')` 拿配置。
数据库连接加了 `timezone: '+08:00'`(中国时区)和 `charset: 'utf8mb4'`(支持中文)。

### 3. `db.js` — 数据库层(新手重点看)
- `init()`:启动时执行。先用**不带库名**的连接 `CREATE DATABASE IF NOT EXISTS`,再创建带库名的**连接池**,最后建 7 张表。
- **连接池**是什么:预创建一批(10 个)数据库连接放着,谁要查询就拿一个、用完归还。避免"每次请求都重新连数据库"的昂贵开销。
- 两个查询助手:
  ```js
  await db.q(sql, [参数])    // 返回数组(多行)
  await db.q1(sql, [参数])   // 返回第一行或 null(单行)
  ```
  全部用 `?` 占位符传参(参数化查询,防止 SQL 注入——新手记住:**永远不要用字符串拼 SQL 值**)。

### 4. `utils.js` — 工具函数
- `genSignCode()`:随机 6 位数字签到码
- `genInviteCode()`:随机 6 位字母数字邀请码(去掉易混字符 0/O/1/I)
- `haversine(lat1,lng1,lat2,lng2)`:球面距离公式,算两个 GPS 坐标距离多少米(定位签到用)
- `taskEnded(task)`:判断任务是否到期(以服务端时间为准)

### 5. `auth.js` — 鉴权中间件
- `auth`:从请求头取 `Authorization: Bearer <token>`,用 `jwt.verify` 验签。通过就把 `{id,name,role,account}` 挂到 `req.user`,后续路由直接用;失败返回 401。
- `requireRole('teacher'|'student')`:角色守卫,套在路由上拦截没权限的角色(403)。
- **JWT 通俗解释**:登录成功后服务器把 `{id, name, role}` 加密签名成一段字符串发给前端;前端存 localStorage,之后每次请求放请求头里;服务器验签就知道"你是谁",不用存会话状态。

### 6. `seed.js` — 种子数据(可重复执行)
用 `TRUNCATE` 清空 7 张表(顺带重置自增 id),然后造出:
- 1 教师(t001)+ 10 学生(s001~s0010),密码全 bcrypt 哈希成 `123456`
- 3 门课程(高数/线代/数据结构)+ 选课关系
- 5 个任务覆盖所有状态:进行中签到码、进行中定位、24h 内可补签缺勤、3 天前历史任务(补签通过+请假)、待审补签任务
- 1 条待审补签 + 1 条待审请假 + 1 条已通过请假
- 注意:种子里的时间是**相对当前时间**算的(如 `min(-5)` 表示 5 分钟前),所以每次 seed 后演示数据都是"新鲜"的。

### 7. `server.js` — 入口 + 全部 API(按块读)
结构顺序:引入依赖 → `app.use(express.json())`(解析 JSON 请求体)→ `app.use(express.static('public'))`(托管页面)→ 一堆路由 → 统一错误处理 → 启动监听。

**公共函数**:
- `err(res, status, msg)`:统一错误格式 `{code, message}`
- `signJwt(u)`:签发 7 天有效期的 token
- `ensureEnded(task)`:任务到点就顺手把库里的 active 改成 ended(**惰性结束**——不靠定时器,谁访问谁触发,简单可靠)
- `coveringLeave(studentId, task)`:查有没有覆盖该任务的请假(pending/approved)
- `myTaskStatus(task, studentId)`:**学生视角任务状态派生**,返回 8 种状态之一:
  `unsigned`(未签)/ `normal` / `leave`(请假) / `leave_pending`(请假审批中) /
  `absent_can_appeal`(缺勤且 24h 内可补签) / `absent` / `appeal_pending` / `appeal_approved` / `appeal_rejected`

**路由分组**(对照 README API 表看):

| 组 | 关键点 |
|---|---|
| /auth/* | register(查重→bcrypt 哈希→入库)、login(查用户→bcrypt 比对→发 JWT) |
| /courses/* | 创建课程时邀请码**循环查库防碰撞**;join 幂等(已加入报错) |
| /signin-tasks/* | 发起签到:同课程同时只能 1 个 active;签到 sign:按固定顺序拦截——任务存在→是本课程学生→没签过→时间窗→请假覆盖→码/距离;records:四分组名单(已签/未签/请假/补签) |
| /appeals/* | 申请校验:任务已结束+本人缺勤+24h 内+没申请过;审批用**事务**同时改 appeals 和 signin_records 两表 |
| /leaves/* | 申请校验:时间段至少覆盖 1 个任务;审批通过时**事务**批量把覆盖任务的记录置 leave |
| /stats/* | 单任务统计(缺勤/请假排最前);课程整体统计(每人出勤率) |

**事务是什么**(新手必懂):一段"要么全部成功、要么全部回滚"的操作。比如审批请假要改 2 张表,如果改完第一张、第二张失败,数据就半新半旧(脏数据)。`conn.beginTransaction() → 全部执行 → commit()`,中途出错 `rollback()` 全部撤销。

### 完整 API 表

统一前缀 `/api`,鉴权头 `Authorization: Bearer <token>`,错误统一 `{code, message}`。

| 方法 | 路径 | 谁能调 | 说明 |
|---|---|---|---|
| POST | /auth/register | 所有人 | 注册 {account, name, password, role} |
| POST | /auth/login | 所有人 | 登录,返回 {token, user} |
| GET | /auth/me | 已登录 | 当前用户信息 |
| GET | /courses | 已登录 | 按角色返回课程(教师含邀请码+人数) |
| POST | /courses | 教师 | 创建课程 {name},返回 invite_code |
| POST | /courses/join | 学生 | {invite_code} 加入课程 |
| POST | /courses/:id/regenerate-code | 教师 | 重置邀请码 |
| POST | /signin-tasks | 教师 | 发起签到 {course_id, type, end_time} 或定位加 {center_lat, center_lng, radius_m} |
| GET | /signin-tasks/active | 学生 | 进行中任务(含我的状态) |
| GET | /signin-tasks?course_id= | 已登录 | 课程任务列表 |
| GET | /signin-tasks/:id/records | 教师 | 已签/未签/请假/补签四分组名单 |
| POST | /signin-tasks/:id/sign | 学生 | 签到 {code} 或 {lat, lng} |
| POST | /signin-tasks/:id/end | 教师 | 提前结束任务 |
| GET | /appeals/available | 学生 | 24h 内可补签缺勤列表 |
| POST | /appeals | 学生 | 提交补签 {task_id, reason≥10字} |
| GET | /appeals/my | 学生 | 我的补签申请 |
| GET | /appeals?status= | 教师 | 审批列表 |
| PUT | /appeals/:id/review | 教师 | {approve, comment} 事务审批 |
| POST | /leaves | 学生 | 提交请假 {course_id, leave_type, start_time, end_time, reason} |
| GET | /leaves/my | 学生 | 我的请假 |
| GET | /leaves?status= | 教师 | 审批列表 |
| PUT | /leaves/:id/review | 教师 | {approve, comment} 事务审批,通过时批量置 leave |
| GET | /signin-tasks/:id/stats | 教师 | 单次任务统计(缺勤/请假排最前) |
| GET | /courses/:id/stats | 教师 | 课程整体统计(每生出勤率) |

## 七、前端文件讲解 `public/index.html`

单文件应用(约 1100 行):HTML 结构 + CSS + Vue 3 代码全在这一个文件里,零构建。

- **引入方式**:`<script src="/vendor/vue.global.prod.min.js">` 等 —— 依赖库已**本地化**到 `public/vendor/`,由自己服务器提供,不怕外网 CDN 挂掉。
- **组件**:全局注册一个 `TaskCard` 组件(首页签到任务卡,含倒计时和 8 态按钮状态机);其他页面用 `v-if`/`v-show` 直接切换,不引入 vue-router(新手从简)。
- **Vue 3 写法**:全部逻辑在 `setup()` 里,`ref()` 声明响应式变量(改它页面自动更新)、`reactive()` 声明响应式对象、`computed()` 计算属性(如问候语、标题)。
- **API 封装**:`api(method, path, body)` 一个函数搞定 fetch + 自动带 token + 统一报错 + 401 自动登出。
- **页面状态机**:`overlay` 变量控制二级页面(签到页/请假页/审批页等),`activeTab` 控制底部 Tab。
- **倒计时**:`nowTick` 每秒 `setInterval` 更新,模板里 `fmtCountdown(end)` 计算剩余时间。
- **定位签到**:浏览器 `navigator.geolocation` 拿坐标 → 前端实时算距离 → 距离 ≤ 半径才放行 → 提交时**后端再算一遍**(前端只是体验,后端才是权威)。

## 八、测试脚本

| 文件 | 干什么 | 怎么跑 |
|---|---|---|
| smoke.js | API 冒烟测试:登录、发起、签到、名单、统计一条龙 | `node smoke.js`(需先启动服务,且先 seed) |
| e2e.js | 端到端:请假/补签审批事务、定位签到距离校验、课程加入 | `node e2e.js`(跑完会改数据,建议先 seed) |

> 每次改完后端或前端,跑一遍这俩脚本验证没有改坏东西,是低成本的好习惯。

## 九、核心业务链路(串起来看)

**链路 1 — 学生签到码签到**
```
教师创建任务(生成码 123456)→ 学生首页拉 /signin-tasks/active 看到任务卡
→ 点"立即签到"进签到页 → 输 6 位码 → doSign() → POST /sign/ 带 {code}
→ 服务端拦截检查(没签过?没过期?没请假?)→ INSERT 一条 normal 记录 → 返回 ok
→ 前端弹"签到成功"→ 教师管理页 5 秒轮询 /records 看到已签 +1
```

**链路 2 — 缺勤 → 补签 → 审批**
```
任务结束且学生无记录 → myTaskStatus 派生 absent_can_appeal(24h 内)
→ 学生提交补签(≥10 字理由)→ appeals 表新增 pending + records 置 appeal_pending
→ 教师审批中心看到待办 → 通过 → 事务:appeals 置 approved + records 置 appeal_approved
→ 统计里该生从缺勤变"补签通过",出勤率按通过计入
```

**链路 3 — 请假拦截签到**
```
学生提交请假(时间段覆盖某任务)→ 审批中:sign 接口查到 pending 请假 → 拒绝签到"请假审批中"
→ 教师通过 → 事务:该任务该生记录置 leave → 出勤率分母剔除该人次
→ 教师拒绝 → 任务未结束:恢复正常可签;已结束:可走补签
```

## 十、新手学习路线建议

1. **先跑起来**,用两个浏览器(一个教师一个学生)把三条链路全走一遍,直观感受"前后端怎么配合"。
2. **打开浏览器 F12 → Network 面板**,每点一个按钮,看发出的请求(方法、URL、请求体、响应)——这是理解前后端交互最快的办法。
3. **读代码顺序**:config.js → db.js → auth.js → server.js(按路由块)→ index.html(按页面块)。
4. **动手改**:比如把"补签窗口 24h"改成 48h(只在 server.js 的 appeals 里改一处数字),改完自己测,这是最好的练习。
5. 学会用 `node smoke.js` 和 curl 直接调 API,先脱离页面验证后端,再联调前端。

## 十一、踩坑记录(全部真实发生过)

1. **`<van-nav-bar />` 自闭合标签坑**:HTML 解析器只认 `<br>` 这类原生空元素的自闭合,`<van-xxx />` 会被当成开标签,**把后面的内容全吞掉** → 页面空白/tabbar 消失。教训:Vue 组件标签一律写显式闭合 `<van-xxx></van-xxx>`。
2. **`<template v-if>` 放在 DOM 模板里**:浏览器 HTML 解析器会把 template 内容挪进 document fragment,内容丢失。教训:页面内模板用 `<div v-if>`。
3. **Vant 4 API 改名**:`vant.Toast()`/`vant.Dialog` 是 Vant 3 的,Vant 4 改成 `vant.showToast()`/`vant.showDialog()`/`vant.showConfirmDialog()` → 点按钮没反应且不报错。
4. **van-tabbar-item 不写 name**:默认回传数字索引,和字符串 `'home'` 比对永远 false → 切 Tab 后全部页面隐藏。教训:组件绑定 v-model 时写死 name。
5. **密码必须加盐哈希存储**:bcrypt 会自动加盐,`hashSync(pwd, 10)` 的 10 是计算强度(越大越慢越安全);登录用 `compareSync` 比对,永远不做明文比对。
6. **SQL 拼接 vs 参数化**:值一律用 `?` 占位符传参,防注入。
7. **TRUNCATE 才重置自增**:seed 里用 DELETE 清空后自增 id 不归零,后续代码硬编码 id 会错位,TRUNCATE 顺带重置。
8. **前端倒计时只是展示,后端才是裁判**:所有时间判定用服务端时间,前端倒计时到 0 只是体验;签发 token、校验签到都以后端为准。
9. **审批必须用事务**:涉及两张表(申请表+记录表)的更新,不用事务可能造成"申请已通过但记录没改"的脏数据。

## 十二、常用命令

```powershell
npm install       # 装依赖
npm run seed      # 重置演示数据(清空重建)
npm start         # 启动 http://localhost:3000
node smoke.js     # API 冒烟测试
node e2e.js       # 端到端测试
```

# 早八签到系统 · 全栈入门指南

一个真实可用的学生/教师双端签到系统:签到码 + GPS 定位签到,支持补签、请假、审批、统计。
本 README 面向**新手**:逐文件讲清架构和功能,附学习路线和真实踩坑记录。

---

## 一、这是什么

- **学生端**:登录 → 加入课程 → 首页看到进行中签到(倒计时)→ 输码/定位签到 → 缺勤可 24h 内补签 → 可请假
- **教师端**:登录 → 创建课程(生成邀请码)→ 发起签到(签到码/定位)→ 实时看名单 → 审批补签/请假 → 看统计

架构上它是**单服务应用**:一个 Node.js 进程(Express)同时干两件事——
1. 提供 REST API(前端通过 `fetch` 调用)
2. 托管前端页面(浏览器访问 `http://localhost:3000` 拿到 Vite 构建产物 `dist/`)

前端是 **Vue 3 单文件组件(SFC)工程**,开发时跑 Vite 热更新,构建后由 Express 直接托管,不需要额外的前端服务器进程。

## 二、技术栈(每项一句话)

| 层 | 技术 | 一句话说明 |
|---|---|---|
| 后端 | Node.js + Express | Node 是"在服务器上跑 JS"的运行时;Express 是最流行的 Node Web 框架 |
| 数据库 | MySQL 8+ | 关系型数据库,数据存在服务器上,7 张表 |
| 数据库驱动 | mysql2 | 让 Node 代码能连接并操作 MySQL 的库(连接池模式) |
| 密码加密 | bcryptjs | 密码加盐哈希,数据库里存的是密文,不是明文 |
| 登录鉴权 | jsonwebtoken (JWT) | 登录成功后发一张"电子凭证",之后每次请求带着它证明身份 |
| 前端 | Vue 3 SFC + Vant 4 | `.vue` 单文件组件,组件拆到 `src/views/`;Vant 提供移动端 UI 组件 |
| 构建工具 | Vite | 开发热更新 + 打包构建,产出 `dist/` 静态文件 |
| 地图 | Leaflet | 教师发起定位签到时在地图上选中心点 |
| 测试 | 原生 fetch 脚本 | smoke.js/e2e.js 用 Node 自带 fetch 测 API |

**核心依赖版本**(package.json):express ^5.1.0、mysql2 ^3.14.3、bcryptjs ^3.0.2、jsonwebtoken ^9.0.2、vue ^3.5、vite ^8、vant ^4.10

## 三、整体架构

```
手机/浏览器
   │  ① 打开 http://localhost:3000 (开发时是 5173)
   ▼
dist/index.html (Vite 构建产物,由 src/ 的 .vue 组件编译而来)
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
cd C:\Users\zms15\Desktop\check-in
npm install     # 首次:装依赖到 node_modules
npm run seed    # 建库建表 + 灌演示数据(可重复执行,会清空数据)
```

**开发模式**(推荐,改代码页面自动刷新):开两个终端——

```powershell
npm start       # 终端 1:启动后端 API,监听 3000
npm run dev     # 终端 2:启动 Vite,浏览器打开 http://localhost:5173
```

Vite 开发服务器监听 5173 端口,并把 `/api` 请求自动代理给后端的 3000 端口(见 `vite.config.mjs`),所以前端代码里直接写 `/api/xxx` 就行。

**生产模式**(部署):构建一次,之后一个命令全起来——

```powershell
npm run build   # 把 src/ 的组件编译打包到 dist/
npm start       # Express 托管 dist/,浏览器打开 http://localhost:3000
```

演示账号(密码都是 `123456`):教师 `t001`;学生 `s001` ~ `s0010`。

### 管理员账号(单独创建,注册页不开放)

管理员是"教师超集":能看全部课程、审批所有人的申请,并且多一个「用户管理」菜单,可以删除非管理员账号(连带清理其课程/签到/申请)。管理员**不能**通过注册页注册 —— 注册接口只接受 `student` / `teacher`。

```powershell
npm run create-admin -- admin admin123 系统管理员   # 不存在则创建,已存在则提权并重置密码
```

`npm run seed` 也会顺带建一个 `admin` / `admin123`。管理员登录后左侧会多出「用户管理」,可查看全部账号并按需删除。

`.env` 存数据库密码等敏感配置(已被 .gitignore 忽略,不会提交到 git)。`npm start` 里的 `--env-file=.env` 就是让 Node 启动时自动把 .env 读成环境变量。

## 五、数据库设计(7 张表)

库名 `zaoba_signin`。建表语句在 `db.js` 的 `createTables()`,幂等(IF NOT EXISTS,重复执行不报错)。

### 1. users — 用户(学生+教师)
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT 自增主键 | 每张表都有 |
| account | VARCHAR(50) UNIQUE | 学号/工号,登录账号,唯一 |
| name | VARCHAR(50) | 姓名 |
| role | ENUM('student','teacher','admin') | 角色,决定进哪个端(admin = 教师超集) |
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
- `requireRole('teacher'|'student')`:角色守卫,套在路由上拦截没权限的角色(403)。管理员视为教师超集,`teacher` 路由对管理员放行,`student` 路由不放行。
- **JWT 通俗解释**:登录成功后服务器把 `{id, name, role}` 加密签名成一段字符串发给前端;前端存 localStorage,之后每次请求放请求头里;服务器验签就知道"你是谁",不用存会话状态。

### 6. `seed.js` — 种子数据(可重复执行)
用 `TRUNCATE` 清空 7 张表(顺带重置自增 id),然后造出:
- 1 教师(t001)+ 10 学生(s001~s0010),密码全 bcrypt 哈希成 `123456`;外加 1 个管理员 `admin` / `admin123`
- 3 门课程(高数/线代/数据结构)+ 选课关系
- 5 个任务覆盖所有状态:进行中签到码、进行中定位、24h 内可补签缺勤、3 天前历史任务(补签通过+请假)、待审补签任务
- 1 条待审补签 + 1 条待审请假 + 1 条已通过请假
- 注意:种子里的时间是**相对当前时间**算的(如 `min(-5)` 表示 5 分钟前),所以每次 seed 后演示数据都是"新鲜"的。

### 7. `server.js` — 入口 + 全部 API(按块读)
结构顺序:引入依赖 → `app.use(express.json())`(解析 JSON 请求体)→ `app.use(express.static('dist'))`(托管前端构建产物)→ 一堆路由 → 统一错误处理 → 启动监听。

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
| GET | /admin/users | 管理员 | 全部账号(含课程数/签到数,不含密码哈希) |
| DELETE | /admin/users/:id | 管理员 | 删除非管理员账号,事务级联清理其课程/任务/记录/申请 |

## 七、前端讲解 `src/`(Vue 3 单文件组件)

前端是标准的 **Vite + Vue 3 SFC 工程**,源码都在 `src/`,入口链:

```
index.html(项目根目录,Vite 入口)
  └─ src/main.js          # createApp + 全量注册 Vant + 引入全局样式
      └─ src/App.vue      # 根组件:管登录态,按角色挂登录页/学生端/教师端
          ├─ views/LoginPage.vue       # 登录 + 注册弹窗
          ├─ views/StudentHome.vue     # 学生端:4 个 Tab + 二级页面
          └─ views/TeacherHome.vue     # 教师端:4 个 Tab + 二级页面
```

| 文件 | 干什么 |
|---|---|
| `api.js` | `api(method, path, body)` 封装 fetch:自动带 token、统一报错、401 自动登出 |
| `utils.js` | 通用函数:`fmtTime` 时间格式化、`statusText/statusColor` 状态文案、`copyCode` 复制 |
| `useNow.js` | composable:每秒更新的"当前时间"ref,驱动页面上的倒计时 |
| `style.css` | 全局样式(登录框、任务卡、统计格子等自定义样式) |
| `components/OverlayPage.vue` | 二级页面通用外壳:顶部返回导航栏 + 可滚动内容区(slot) |
| `components/TaskCard.vue` | 首页签到任务卡:倒计时 + 8 态按钮状态机 |
| `views/` | 各页面组件(见下表) |

**页面组件与职责**(二级页面都是"子组件",由 StudentHome/TeacherHome 用 `v-if` 挂载,靠 props 传数据、emit 事件回报):

| 组件 | 端 | 职责 |
|---|---|---|
| SignPage | 学生 | 签到页:输 6 位码 / 定位签到(实时算距离,后端再验一遍) |
| AppealApplyPage | 学生 | 24h 内缺勤申请补签(理由 ≥10 字) |
| LeaveApplyPage | 学生 | 请假:选课程/类型/时间段/理由 |
| CourseDetailPage | 双端 | 课程详情,按 `role` prop 显示学生版或教师版 |
| CreateTaskPage | 教师 | 发起签到:码/定位(Leaflet 地图拖点选中心 + 半径) |
| TaskManagePage | 教师 | 签到管理:展示签到码、提前结束、5 秒轮询四分组名单 |
| ApprovalDetailPage | 教师 | 补签/请假审批:详情 + 通过/拒绝 |
| TaskStatsPage | 教师 | 单次任务统计:出勤率 + 按姓名/学号搜索 |
| CourseStatsPage | 教师 | 课程整体统计:每名学生累计出勤率 |

**关键设计**:

- **组件通信**:父组件持有数据,子页面用 props 接收、`emit('submitted')` 等事件告诉父组件"提交成功,刷新数据"。子组件内部自管理加载中状态和定时器,`onUnmounted` 自动清理(比原来的全局状态机更内聚)。
- **登录态**:token 和 user 存 localStorage,App.vue 的 `user` ref 决定渲染哪个端;`api.js` 收到 401 时清 token 并回调 App.vue 的 logout。
- **页面切换**:没引入 vue-router,主界面用底部 Tabbar + `v-show`,二级页面用 `v-if` 覆盖层(新手从简)。
- **倒计时**:`useNow()` composable 每秒 `setInterval` 刷新,模板里 `fmtCountdown(end, now)` 重新计算。
- **定位签到**:浏览器 `navigator.geolocation` 拿坐标 → 前端实时算距离 → 距离 ≤ 半径才放行 → 提交时**后端再算一遍**(前端只是体验,后端才是权威)。
- **Vant 全量注册**:`app.use(Vant)` 后模板里所有 `<van-xxx>` 组件开箱即用;打包体积约 160KB gzip,对这个体量的应用完全可接受(想优化可再学按需引入)。

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
3. **读代码顺序**:config.js → db.js → auth.js → server.js(按路由块)→ src/ 前端(先看 main.js → App.vue → 两个 Home,再看二级页面组件)。
4. **动手改**:比如把"补签窗口 24h"改成 48h(只在 server.js 的 appeals 里改一处数字),改完自己测,这是最好的练习。
5. 学会用 `node smoke.js` 和 curl 直接调 API,先脱离页面验证后端,再联调前端。

## 十一、踩坑记录(全部真实发生过)

1. **`<van-nav-bar />` 自闭合标签坑(仅 DOM 模板)**:浏览器 HTML 解析器只认 `<br>` 这类原生空元素的自闭合,`<van-xxx />` 会被当成开标签,**把后面的内容全吞掉** → 页面空白。本项目已迁到 SFC 后此坑消失(Vue 编译器会正确处理),但如果哪天上 CDN 方式写 DOM 模板,务必写显式闭合。
2. **SFC 里不要混写两个 `<script>` 块**:`<script setup>` 之外再加 `<script>` 时,普通块只用于定义组件选项(如 `name`、`inheritAttrs`),不能在里面写 `export default {}` 和模板要用的工具函数——模板只能访问 `<script setup>` 顶层声明的变量。
3. **Vant 4 API 改名**:`vant.Toast()`/`vant.Dialog` 是 Vant 3 的,Vant 4 改成 `vant.showToast()`/`vant.showDialog()`/`vant.showConfirmDialog()`;工程化下更推荐 `import { showToast } from 'vant'` 直接按需引入函数。
4. **van-tabbar-item 不写 name**:默认回传数字索引,和字符串 `'home'` 比对永远 false → 切 Tab 后全部页面隐藏。教训:组件绑定 v-model 时写死 name。
5. **Leaflet 默认 marker 图标在 Vite 下 404**:Leaflet 的默认图标是 CSS 里引用的相对路径图片,Vite 打包后路径对不上 → marker 图标裂图。方案:用 `L.divIcon` 塞 emoji(本项目 📍 就是这么做的),或显式 import 图标资源改 `L.Icon.Default`。
6. **Vite 配置文件的模块格式**:项目 `package.json` 没有 `"type": "module"`(后端是 CommonJS),`vite.config.js` 里写 `import` 语法会有警告,把配置文件名改成 `vite.config.mjs` 即可。
7. **密码必须加盐哈希存储**:bcrypt 会自动加盐,`hashSync(pwd, 10)` 的 10 是计算强度(越大越慢越安全);登录用 `compareSync` 比对,永远不做明文比对。
8. **SQL 拼接 vs 参数化**:值一律用 `?` 占位符传参,防注入。
9. **TRUNCATE 才重置自增**:seed 里用 DELETE 清空后自增 id 不归零,后续代码硬编码 id 会错位,TRUNCATE 顺带重置。
10. **前端倒计时只是展示,后端才是裁判**:所有时间判定用服务端时间,前端倒计时到 0 只是体验;签发 token、校验签到都以后端为准。
11. **审批必须用事务**:涉及两张表(申请表+记录表)的更新,不用事务可能造成"申请已通过但记录没改"的脏数据。

## 十二、常用命令

```powershell
npm install       # 装依赖
npm run seed      # 重置演示数据(清空重建)
npm start         # 启动后端 http://localhost:3000(需先 npm run build)
npm run dev       # 开发模式:Vite 热更新 http://localhost:5173
npm run build     # 构建前端到 dist/
npm run create-admin -- <账号> <密码> [姓名]   # 创建/提权管理员
node smoke.js     # API 冒烟测试
node e2e.js       # 端到端测试
```

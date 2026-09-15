# 早八签到系统

学生/教师双端签到系统:签到码 + GPS 定位签到,支持补签、请假、审批、统计。
单服务架构:Express 同时提供 API 和静态页面,数据库 MySQL。

## 环境要求

- Node.js ≥ 20(当前 v24)
- MySQL ≥ 8(本机已装)

## 启动

```bash
npm install          # 首次安装依赖
npm run seed         # 建库建表 + 灌演示数据(可重复执行,会清空数据)
npm start            # 启动 http://localhost:3000
```

数据库连接配置在 `.env`(密码不要提交到 git,已在 .gitignore)。

## 演示账号

| 角色 | 账号 | 密码 |
|---|---|---|
| 教师 | t001 | 123456 |
| 学生 | s001 ~ s0010 | 123456 |

种子数据自带:1 个进行中签到码任务、1 个进行中定位任务(天安门 300m)、
1 条 24h 内可补签缺勤、1 条待审补签、1 条待审请假。

## 手机真机访问(定位签到必需 HTTPS)

浏览器定位 API 要求安全上下文,localhost 直接可用;
手机局域网访问需 HTTPS,用 mkcert 生成证书后给 server.js 套上即可(详见 docs/证书.md)。

## 主要 API

统一前缀 `/api`,JWT 鉴权(`Authorization: Bearer <token>`),错误格式 `{code, message}`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /auth/register | 注册(account/name/password/role) |
| POST | /auth/login | 登录,返回 JWT |
| GET | /auth/me | 当前用户 |
| GET | /courses | 按角色返回课程(教师含邀请码+人数) |
| POST | /courses | 教师创建课程,返回 6 位邀请码 |
| POST | /courses/join | 学生输邀请码加入 |
| POST | /courses/:id/regenerate-code | 教师重置邀请码 |
| POST | /signin-tasks | 教师发起签到(code 或 location+坐标+半径+end_time) |
| GET | /signin-tasks/active | 学生:进行中任务(含我的状态) |
| GET | /signin-tasks?course_id= | 课程任务列表 |
| GET | /signin-tasks/:id/records | 教师:已签/未签/请假/补签四分组名单 |
| POST | /signin-tasks/:id/sign | 签到(body: {code} 或 {lat,lng}) |
| POST | /signin-tasks/:id/end | 教师提前结束 |
| GET | /appeals/available | 学生:24h 内可补签缺勤列表 |
| POST | /appeals | 提交补签(理由 ≥10 字,同任务幂等) |
| GET | /appeals/my | 我的补签申请 |
| GET | /appeals?status= | 教师审批列表 |
| PUT | /appeals/:id/review | 审批补签(事务) |
| POST | /leaves | 提交请假(覆盖至少一个任务) |
| GET | /leaves/my | 我的请假 |
| GET | /leaves?status= | 教师审批列表 |
| PUT | /leaves/:id/review | 审批请假(通过时事务批量置 leave) |
| GET | /signin-tasks/:id/stats | 单次任务统计 |
| GET | /courses/:id/stats | 课程整体统计(出勤率=正常+补签通过 / 任务-请假) |

## 核心规则

- 出勤率 = (正常签到 + 补签通过) / (已结束任务数 − 请假数)
- 任务结束 24 小时内可补签,超窗只能记缺勤
- 请假审批中/通过 → 该时段任务签到被拦截
- 所有时间判定以服务端时间为准,到期的任务惰性置 ended
- 审批操作走数据库事务,杜绝半提交

## 目录结构

```
早八签到/
├── server.js      # Express 入口 + 全部 API
├── db.js          # MySQL 连接池 + 建库建表
├── seed.js        # 种子数据
├── config.js      # 配置(读 .env)
├── auth.js        # JWT 中间件 + 角色守卫
├── utils.js       # 码生成 / haversine 距离
├── .env           # 数据库密码等(勿提交)
└── public/
    └── index.html # Vue3 + Vant 单页(学生端 + 教师端全部页面)
```

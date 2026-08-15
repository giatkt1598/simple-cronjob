# Simple Cronjob

Tool TypeScript để chạy các công việc tùy ý trên Windows thông qua Task Scheduler.

## Cài đặt

```powershell
npm install
```

Yêu cầu Node.js 18+ và Windows Task Scheduler.

## Tạo job mới

Tạo file mới trong `src/cronjobs/` với suffix `.cronjob.ts`:

```ts
import { CronJob } from "../src/core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../src/core/types.js";

@CronJob({
  description: "Backup database mỗi 15 phút",
  schedule: "*/15 * * * *",
  enabled: true,
})
export class BackupDatabaseJob implements CronJobHandler {
  async execute(context: CronJobContext): Promise<void> {
    context.logger.info("Thực hiện backup...");
    // Dùng child_process, database client, HTTP client... tùy nhu cầu.
  }
}
```

Job id được lấy từ tên file: `backup-database.cronjob.ts` trở thành `backup-database`.

`enabled` mặc định là `true`. Đặt `enabled: false` để tạm ngừng job; job vẫn được validate và hiển thị trong `list`, nhưng Task Scheduler task tương ứng sẽ không được tạo hoặc sẽ bị xóa khi chạy reconciliation.

Cậu cũng có thể disable job bằng cách thêm `_` ở đầu tên file: `_backup-database.cronjob.ts`. Job id vẫn là `backup-database`, vì vậy `npm run start` sẽ xóa đúng task cũ `SimpleCronJob\backup-database` nếu task đó đang tồn tại.

## Logger

Mỗi job nhận được `context.logger`. Logger chỉ ghi vào file plain text theo format Serilog; job chạy trong Task Scheduler sẽ không tạo log output trên console:

```text
[2026-08-15 11:05:07.123 +07:00 INF] Job completed {JobId="hello"}
```

Log được lưu tại:

```text
logs/<job-name>/YYYY-MM/log - <job-name> - YYYY-MM-DD.txt
```

Các level được hỗ trợ: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Timestamp và thư mục ngày/tháng dùng local timezone của Windows.

## Commands

```powershell
npm run validate
npm run list
npm run start
node dist/index.js run --job hello
```

`npm run start` sẽ type-check, build, discover job và reconcile các task có prefix `SimpleCronJob` trong Windows Task Scheduler. Mỗi task được trigger mỗi phút; application tự kiểm tra 5-field cron expression trước khi execute.

Task chạy bằng user hiện tại ở chế độ logged-on. Không hardcode secrets trong source; dùng environment variables hoặc configuration của project.

Cron fields theo thứ tự: `minute hour day-of-month month day-of-week`. Hỗ trợ `*`, list, range và step, ví dụ `*/5 12-13 * * 1,3`.

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
import { CronJob } from "../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../core/types.js";

@CronJob({
  description: "Backup database mỗi 15 phút",
  schedule: "*/15 * * * *",
  enabled: true,
  parallel: false,
  startAt: "2026-08-16 09:00:00",
  stopAt: "2026-08-30 18:00:00",
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

`parallel` mặc định là `false`. Khi `parallel: false`, job mới sẽ bị skip nếu instance trước đó chưa hoàn tất. Đặt `parallel: true` nếu muốn cho phép nhiều process của cùng job chạy song song; Task Scheduler sẽ dùng `MultipleInstancesPolicy=Parallel` cho job đó.

`startAt` không bắt buộc và dùng format `YYYY-MM-DD HH:mm:ss` theo local timezone của Windows. Trước thời điểm này, Task Scheduler không trigger job và lệnh chạy thủ công cũng không execute job.

`stopAt` không bắt buộc và dùng cùng format. Khi đến hoặc quá thời điểm này, job không execute nữa; task tương ứng sẽ được remove ở lần trigger kế tiếp hoặc trong lần `npm run start` tiếp theo. `stopAt` phải sau `startAt` nếu cả hai cùng được khai báo. Source file không bị xóa.

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

## Utilities

Các utility dùng chung được export từ `src/utilities/index.ts`:

```ts
import {
  requestJson,
  retry,
  runCommand,
  writeJson,
} from "../utilities/index.js";

const command = await runCommand("giatk -v");
const response = await retry(
  () => requestJson("https://example.com/health"),
  { maxAttempts: 3, delayMs: 1_000 },
);
await writeJson("tmp/result.json", { command, status: response.status });
```

Utility v1 gồm `runCommand`, `assertCommandSuccess`, `retry`, `withTimeout`, `requestText`, `requestJson`, `ensureDirectory`, `fileExists`, `readJson`, `writeJson`, `getEnv`, `requireEnv` và `isWindows`.

Task Scheduler chạy qua `wscript.exe` hidden launcher để Node job chạy nền và không bật console window. Launcher vẫn giữ nguyên user context, working directory và exit code của Node process.

Task chạy bằng user hiện tại ở chế độ logged-on. Không hardcode secrets trong source; dùng environment variables hoặc configuration của project.

Cron fields theo thứ tự: `minute hour day-of-month month day-of-week`. Hỗ trợ `*`, list, range và step, ví dụ `*/5 12-13 * * 1,3`.

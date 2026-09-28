# 給与計算カレンダー

フリーランス・副業向けの月次給与計算Webアプリです。カレンダーに勤務情報を登録するだけで、給与・残業代・交通費を自動で計算します。

## できること

- **勤務登録** — 案件名・開始/終了時刻・休憩時間・交通費をカレンダーの日付に紐づけて記録
- **給与自動計算** — 所定労働時間を超えた分は割増賃金で自動計算（倍率も設定可能）
- **リアルタイムプレビュー** — フォーム入力中に勤務時間・残業時間・給与・合計をその場で確認
- **月次サマリー** — 勤務日数・総勤務時間・給与合計・交通費込み総計を月単位で集計表示
- **案件ごとの設定** — 時給・所定労働時間・割増倍率を案件単位で上書き可能（空白なら基本設定を使用）
- **Googleログイン** — Googleアカウントで認証、データはクラウドに保存（複数デバイスで共有可能）
- **基本設定** — デフォルトの時給・所定労働時間・割増倍率をまとめて管理

## 技術スタック

- React 18 + TypeScript + Vite
- Tailwind CSS v3
- Zustand（状態管理）
- Supabase（認証 + データ永続化）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabase の設定

[Supabase](https://supabase.com) でプロジェクトを作成し、SQL Editorで以下を実行します。

```sql
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date_key text not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  unique (user_id, date_key)
);

create table settings (
  user_id uuid primary key references auth.users,
  data jsonb not null
);

alter table entries enable row level security;
alter table settings enable row level security;

create policy "entries: own data only" on entries
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "settings: own data only" on settings
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Authentication → Providers → Google を有効化してください。

### 3. 環境変数の設定

`.env.local` を作成して接続情報を記入します。

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. 起動

```bash
npm run dev
```

## デプロイ（Vercel）

GitHubリポジトリをVercelに連携し、環境変数（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）をVercelのダッシュボードで設定するだけでデプロイできます。

## 給与・支払予定

- 深夜手当は22時〜翌5時。当日0〜5時開始にも対応します。
- 休憩を除く1勤務の実働8時間超に25%を加算し、深夜と重なる部分は標準設定で50%割増です。
- 深夜倍率の既存設定は深夜用として維持し、最低1.25で計算します。
- 基本設定で支払元ラベルを登録し、勤務ごとに1つ指定してください。分類用タグは別に保持します。
- 支払条件は「勤務開始日の何日後（暦日）」と「締め日・支払月・支払日」を別の方式として設定します。
- 31日は月末。存在しない日はその月の末日に丸めます。土日祝の前後調整は行いません。
- 例: 20日締め翌月25日払いでは、9月20日勤務は10月25日、9月21日勤務は11月25日が予定日です。
- 支払条件と予定日は勤務に保存します。設定変更では動きません。年次サマリーの「最新の支払条件を適用」で個別に更新できます。
- 年次サマリーは勤務月／振込予定月を切り替え可能。分析は振込予定月基準です。前年勤務の翌年払いも集計します。
- 予定額は給与 − 源泉徴収 ＋ 交通費 ＋ その他費用。実振込額は月別に別途入力します。差額合計は入力済み月のみ比較します。
- 支払予定未設定の勤務は振込予定額から除外し、年次サマリーに全年の未設定一覧を表示します。勤務を編集して支払元を指定してください。

### 既存データの移行

初回読み込み時、当日以前の勤務で未指定の時給・所定時間・深夜倍率を、現在の基本設定で固定して保存します。
当時の基本設定の履歴はないため、過去の時給が異なる場合は勤務を個別に修正してください。
新規勤務は登録時に適用賃金を保存します。実振込額は移行しません。従来、勤務月に入力していた場合は入金月との対応を確認してください。
既存のSupabase JSON列内に追加フィールドを保存するため、テーブル追加は不要です。

### 計算の制約

休憩時刻を保持していないため、深夜外に優先して配分する概算です。
同日の複数勤務通算、週40時間超、月60時間超、法定休日、変形労働時間制は未対応です。
本修正では計算式も変更されるため、過去勤務の予定額は旧計算から変わる場合があります。固定するのは適用時給等と支払条件であり、計算結果そのものではありません。

### 検証

Node.js 24で `npm ci`、`npm test`、`npm run build`。
PRのGitHub Actionsで計算・支払日・時給固定・年跨ぎ集計を検証します。
既存のLintエラーは別途対応が必要です。

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

-- Claude / Anthropic API key (Análise IA chat)
alter table if exists app_settings
  add column if not exists claude_api_key text not null default '',
  add column if not exists claude_model text not null default 'claude-sonnet-4-20250514';

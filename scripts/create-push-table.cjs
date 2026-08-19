const { Client } = require("pg");
const c = new Client({
  connectionString: "postgresql://postgres:RJCxEBhDm7DpYvYx@db.tirvmswpccejqasmauug.supabase.co:5432/postgres",
});
c.connect()
  .then(() =>
    c.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id bigint generated always as identity primary key,
        user_id uuid not null,
        endpoint text not null unique,
        subscription text not null,
        created_at timestamptz default now()
      );
      CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);
    `)
  )
  .then(() => { console.log("OK - tabela criada"); c.end(); })
  .catch((e) => { console.error(e.message); c.end(); });

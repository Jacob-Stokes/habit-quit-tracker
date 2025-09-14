// Add user preference columns that might be missing
export async function up(db) {
  // Get existing columns in users table
  const columns = await db.all("PRAGMA table_info(users)")
  const columnNames = columns.map(col => col.name)

  // Add missing columns one by one
  const columnsToAdd = [
    { name: 'default_abstinence_text', sql: "ALTER TABLE users ADD COLUMN default_abstinence_text TEXT DEFAULT 'Abstinence time'" },
    { name: 'show_habits_tab', sql: "ALTER TABLE users ADD COLUMN show_habits_tab BOOLEAN DEFAULT 1" },
    { name: 'show_quits_tab', sql: "ALTER TABLE users ADD COLUMN show_quits_tab BOOLEAN DEFAULT 1" },
    { name: 'show_logs_tab', sql: "ALTER TABLE users ADD COLUMN show_logs_tab BOOLEAN DEFAULT 1" },
    { name: 'custom_title', sql: "ALTER TABLE users ADD COLUMN custom_title TEXT DEFAULT 'Habit Tracker'" },
    { name: 'show_title_section', sql: "ALTER TABLE users ADD COLUMN show_title_section BOOLEAN DEFAULT 1" },
    { name: 'selected_theme', sql: "ALTER TABLE users ADD COLUMN selected_theme TEXT DEFAULT 'light'" }
  ]

  for (const column of columnsToAdd) {
    if (!columnNames.includes(column.name)) {
      await db.run(column.sql)
      console.log(`  ✓ Added ${column.name} column to users table`)
    } else {
      console.log(`  ⏭️  ${column.name} column already exists`)
    }
  }

  // Also check activities table for abstinence columns
  const activityColumns = await db.all("PRAGMA table_info(activities)")
  const activityColumnNames = activityColumns.map(col => col.name)

  if (!activityColumnNames.includes('abstinence_text')) {
    await db.run("ALTER TABLE activities ADD COLUMN abstinence_text TEXT")
    console.log('  ✓ Added abstinence_text column to activities table')
  }

  if (!activityColumnNames.includes('use_default_abstinence_text')) {
    await db.run("ALTER TABLE activities ADD COLUMN use_default_abstinence_text BOOLEAN DEFAULT 1")
    console.log('  ✓ Added use_default_abstinence_text column to activities table')
  }

  console.log('  ✓ User preferences columns verified/added')
}
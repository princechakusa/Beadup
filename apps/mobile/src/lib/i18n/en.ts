/**
 * English: the source of truth for app text. Other languages may translate only
 * part of it: anything missing falls back to English, so a screen is never blank.
 * Add a key here first, then translate it in es.ts, fr.ts and pt.ts.
 * `{name}` placeholders are filled by `t()`.
 */
export const en = {
  tab_today: 'Today',
  tab_calendar: 'Calendar',
  tab_clients: 'Clients',
  tab_money: 'Money',
  greet_morning: 'Morning',
  greet_afternoon: 'Afternoon',
  greet_evening: 'Evening',
  day_today: 'Today',
  day_tomorrow: 'Tomorrow',
  day_yesterday: 'Yesterday',
  week_letters: 'M,T,W,T,F,S,S',
  earned_week: 'Earned this week',
  earned_week_a11y: 'Earned this week {amount}',
  jobs_week: 'Jobs this week',
  avg_ticket: 'Avg ticket',
  rating: 'Rating',
  rating_new: 'New',
  settings: 'Settings',
  opens_reviews: '{label} {value}. Opens reviews',
  next_up: 'Next up',
  see_all: 'See all',
  loading_schedule: 'Loading your schedule…',
  no_jobs: 'No jobs booked yet',
  no_jobs_body: 'Share your booking link above. When clients book, their jobs show up here.',
  booked: 'Booked',
  next_job_a11y: 'Next job, {service} for {client}',
  addon_suffix: '{name} add-on',
  in_progress: 'In progress',
  hours_short: '{n} h',
  start_route: 'Start route',
  text_client: 'Text {name}',
  call_client: 'Call {name}',
} as const;

export type MessageKey = keyof typeof en;

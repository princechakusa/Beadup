import { fmt, type Locale } from "./index";

/**
 * Wording of the emails Beadup sends to a business's clients (confirmation,
 * reminder, reschedule, cancellation, receipt), in the language the client
 * booked in. English is the source; every language must have every key.
 */
export const emailEn = {
  subject_confirmation: "You're booked with {business}",
  intro_confirmation: "Hi {name}, your booking is confirmed.",
  subject_reminder: "Reminder: {service} tomorrow",
  intro_reminder: "Hi {name}, see you tomorrow.",
  subject_rescheduled: "New time for your {service}",
  intro_rescheduled: "Hi {name}, {business} moved your booking.",
  subject_cancelled: "Your booking with {business} is cancelled",
  intro_cancelled: "Hi {name}, this booking has been cancelled. If you paid a deposit, {business} will sort it out with you directly.",
  subject_receipt: "Your receipt from {business}",
  intro_receipt: "Hi {name}, thanks for choosing {business}. Your receipt is ready, with a 30-second rating if you'd like to leave one.",
  row_when: "When",
  row_service: "Service",
  row_with: "With",
  row_where: "Where",
  row_total: "Total",
  row_ref: "Ref",
  row_deposit: "Deposit due",
  cta_receipt: "See receipt and rate",
  cta_again: "Book {business} again",
  cta_page: "Your booking page",
  contact_phone: "Questions? {business}: {phone}",
  contact_none: "Questions? Reply on your booking page.",
  pay_line: "Pay your {amount} deposit to {business}{note}{link}",
  footer: "Sent by Beadup for {business}. You get this email because you booked with them.",
  wa_msg: "Hi {business}, it's {name} (ref {ref}).",
  sender: "{business} via Beadup",
} as const;
export type EmailKey = keyof typeof emailEn;
type EmailMessages = Record<EmailKey, string>;

const es: EmailMessages = {
  subject_confirmation: "Reserva confirmada con {business}",
  intro_confirmation: "Hola {name}, tu reserva está confirmada.",
  subject_reminder: "Recordatorio: {service} mañana",
  intro_reminder: "Hola {name}, nos vemos mañana.",
  subject_rescheduled: "Nuevo horario para tu {service}",
  intro_rescheduled: "Hola {name}, {business} cambió el horario de tu reserva.",
  subject_cancelled: "Tu reserva con {business} está cancelada",
  intro_cancelled: "Hola {name}, esta reserva se ha cancelado. Si pagaste un depósito, {business} lo resolverá contigo directamente.",
  subject_receipt: "Tu recibo de {business}",
  intro_receipt: "Hola {name}, gracias por elegir {business}. Tu recibo está listo, con una valoración de 30 segundos si quieres dejarla.",
  row_when: "Cuándo",
  row_service: "Servicio",
  row_with: "Con",
  row_where: "Dónde",
  row_total: "Total",
  row_ref: "Ref.",
  row_deposit: "Depósito a pagar",
  cta_receipt: "Ver recibo y valorar",
  cta_again: "Reservar de nuevo con {business}",
  cta_page: "Tu página de reserva",
  contact_phone: "¿Preguntas? {business}: {phone}",
  contact_none: "¿Preguntas? Responde en tu página de reserva.",
  pay_line: "Paga tu depósito de {amount} a {business}{note}{link}",
  footer: "Enviado por Beadup en nombre de {business}. Recibes este correo porque reservaste con ellos.",
  wa_msg: "Hola {business}, soy {name} (ref. {ref}).",
  sender: "{business} a través de Beadup",
};

const fr: EmailMessages = {
  subject_confirmation: "Votre réservation chez {business} est confirmée",
  intro_confirmation: "Bonjour {name}, votre réservation est confirmée.",
  subject_reminder: "Rappel : {service} demain",
  intro_reminder: "Bonjour {name}, à demain.",
  subject_rescheduled: "Nouvel horaire pour votre {service}",
  intro_rescheduled: "Bonjour {name}, {business} a déplacé votre réservation.",
  subject_cancelled: "Votre réservation chez {business} est annulée",
  intro_cancelled: "Bonjour {name}, cette réservation a été annulée. Si vous avez versé un acompte, {business} réglera cela directement avec vous.",
  subject_receipt: "Votre reçu de {business}",
  intro_receipt: "Bonjour {name}, merci d'avoir choisi {business}. Votre reçu est prêt, avec une note de 30 secondes si vous souhaitez en laisser une.",
  row_when: "Quand",
  row_service: "Service",
  row_with: "Avec",
  row_where: "Lieu",
  row_total: "Total",
  row_ref: "Réf.",
  row_deposit: "Acompte dû",
  cta_receipt: "Voir le reçu et noter",
  cta_again: "Réserver à nouveau chez {business}",
  cta_page: "Votre page de réservation",
  contact_phone: "Des questions ? {business} : {phone}",
  contact_none: "Des questions ? Répondez sur votre page de réservation.",
  pay_line: "Réglez votre acompte de {amount} à {business}{note}{link}",
  footer: "Envoyé par Beadup pour {business}. Vous recevez cet e-mail parce que vous avez réservé chez eux.",
  wa_msg: "Bonjour {business}, c'est {name} (réf. {ref}).",
  sender: "{business} via Beadup",
};

const pt: EmailMessages = {
  subject_confirmation: "Reserva confirmada com {business}",
  intro_confirmation: "Olá {name}, sua reserva está confirmada.",
  subject_reminder: "Lembrete: {service} amanhã",
  intro_reminder: "Olá {name}, até amanhã.",
  subject_rescheduled: "Novo horário para o seu {service}",
  intro_rescheduled: "Olá {name}, {business} alterou o horário da sua reserva.",
  subject_cancelled: "Sua reserva com {business} foi cancelada",
  intro_cancelled: "Olá {name}, esta reserva foi cancelada. Se você pagou um sinal, {business} resolverá isso diretamente com você.",
  subject_receipt: "Seu recibo de {business}",
  intro_receipt: "Olá {name}, obrigado por escolher {business}. Seu recibo está pronto, com uma avaliação de 30 segundos se quiser deixar uma.",
  row_when: "Quando",
  row_service: "Serviço",
  row_with: "Com",
  row_where: "Onde",
  row_total: "Total",
  row_ref: "Ref.",
  row_deposit: "Sinal a pagar",
  cta_receipt: "Ver recibo e avaliar",
  cta_again: "Reservar novamente com {business}",
  cta_page: "Sua página de reserva",
  contact_phone: "Dúvidas? {business}: {phone}",
  contact_none: "Dúvidas? Responda na sua página de reserva.",
  pay_line: "Pague seu sinal de {amount} a {business}{note}{link}",
  footer: "Enviado pela Beadup em nome de {business}. Você recebe este e-mail porque reservou com eles.",
  wa_msg: "Olá {business}, aqui é {name} (ref. {ref}).",
  sender: "{business} via Beadup",
};

const CATALOGS: Record<Locale, EmailMessages> = { en: emailEn, es, fr, pt };

/** Translator for one language. */
export function emailT(lang: Locale) {
  return (key: EmailKey, vars?: Record<string, string | number>) => fmt(CATALOGS[lang][key], vars);
}
export const emailCatalog = (lang: Locale): EmailMessages => CATALOGS[lang];

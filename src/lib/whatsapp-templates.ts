import type { Message } from "@/lib/crm-types";

export type WhatsAppTemplateLang = "EN" | "ES";
export type WhatsAppTemplateCategory = "inquiry" | "follow_up" | "appointment";

export interface WaTemplateDefinition {
  sid: string;
  label: string;
  category: WhatsAppTemplateCategory;
  lang: WhatsAppTemplateLang;
  variables: string[];
  fallback?: { program?: string };
  render(vars: Record<string, string>): string;
}

const TEMPLATES: Record<WhatsAppTemplateCategory, Record<WhatsAppTemplateLang, WaTemplateDefinition>> = {
  inquiry: {
    EN: {
      sid: process.env.NEXT_PUBLIC_TWILIO_TEMPLATE_INQUIRY_EN_SID || "",
      label: "Inquiry (English)",
      category: "inquiry",
      lang: "EN",
      variables: ["name"],
      render: ({ name }) =>
        `Hi ${name}! Thank you for your interest in GMTTI. Our team will be in touch with you shortly. Reply STOP to opt out.`,
    },
    ES: {
      sid: process.env.NEXT_PUBLIC_TWILIO_TEMPLATE_INQUIRY_ES_SID || "",
      label: "Consulta (Español)",
      category: "inquiry",
      lang: "ES",
      variables: ["name"],
      render: ({ name }) =>
        `¡Hola ${name}! Gracias por su interés en GMTTI. Nuestro equipo se comunicará con usted en breve. Responda STOP para darse de baja.`,
    },
  },
  follow_up: {
    EN: {
      sid: process.env.NEXT_PUBLIC_TWILIO_TEMPLATE_FOLLOWUP_EN_SID || "",
      label: "Follow-up (English)",
      category: "follow_up",
      lang: "EN",
      variables: ["name"],
      render: ({ name }) =>
        `Hi ${name}, just following up on your interest in GMTTI. Would you like to schedule a visit or get more information?`,
    },
    ES: {
      sid: process.env.NEXT_PUBLIC_TWILIO_TEMPLATE_FOLLOWUP_ES_SID || "",
      label: "Seguimiento (Español)",
      category: "follow_up",
      lang: "ES",
      variables: ["name"],
      render: ({ name }) =>
        `Hola ${name}, le hacemos seguimiento sobre su interés en GMTTI. ¿Le gustaría programar una visita o recibir más información?`,
    },
  },
  appointment: {
    EN: {
      sid: process.env.NEXT_PUBLIC_TWILIO_TEMPLATE_APPT_EN_SID || "",
      label: "Appointment (English)",
      category: "appointment",
      lang: "EN",
      variables: ["name"],
      render: ({ name }) =>
        `Hi ${name}, your appointment at GMTTI has been confirmed. Please arrive 10 minutes early.`,
    },
    ES: {
      sid: process.env.NEXT_PUBLIC_TWILIO_TEMPLATE_APPT_ES_SID || "",
      label: "Cita (Español)",
      category: "appointment",
      lang: "ES",
      variables: ["name"],
      render: ({ name }) =>
        `Hola ${name}, su cita en GMTTI ha sido confirmada. Por favor llegue 10 minutos antes.`,
    },
  },
};

// WA_TEMPLATES — positional render used by MessagingModal (inquiry category only)
export const WA_TEMPLATES: Record<
  WhatsAppTemplateLang,
  { sid: string; label: string; render(firstName: string): string }
> = {
  EN: {
    sid: TEMPLATES.inquiry.EN.sid,
    label: TEMPLATES.inquiry.EN.label,
    render: (firstName) => TEMPLATES.inquiry.EN.render({ name: firstName }),
  },
  ES: {
    sid: TEMPLATES.inquiry.ES.sid,
    label: TEMPLATES.inquiry.ES.label,
    render: (firstName) => TEMPLATES.inquiry.ES.render({ name: firstName }),
  },
};

export function getTemplate(
  category: WhatsAppTemplateCategory,
  lang: WhatsAppTemplateLang
): WaTemplateDefinition {
  return TEMPLATES[category][lang];
}

export function findTemplateBySid(sid: string): WaTemplateDefinition | undefined {
  for (const catTemplates of Object.values(TEMPLATES)) {
    for (const tpl of Object.values(catTemplates)) {
      if (tpl.sid && tpl.sid === sid) return tpl;
    }
  }
  return undefined;
}

export function pickTemplateLang(language?: string | null): WhatsAppTemplateLang {
  if (!language) return "EN";
  const l = language.toLowerCase();
  return l.includes("es") || l.includes("spanish") || l.includes("español") ? "ES" : "EN";
}

export function isWhatsAppWindowOpen(messages: Message[]): boolean {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return messages.some(
    (m) =>
      m.channel === "whatsapp" &&
      m.direction === "inbound" &&
      new Date(m.created_at).getTime() > cutoff
  );
}

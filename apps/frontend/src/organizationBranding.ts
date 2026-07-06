function getEnvText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export const organizationBranding = {
  appName: getEnvText(import.meta.env.VITE_APP_NAME) ?? "Bosman",

  organizationName:
    getEnvText(import.meta.env.VITE_ORGANIZATION_NAME) ??
    "Akademia Żeglarstwa Demo",

  loginTitle: getEnvText(import.meta.env.VITE_LOGIN_TITLE) ?? "Dostęp kursanta",

  loginDescription:
    getEnvText(import.meta.env.VITE_LOGIN_DESCRIPTION) ??
    "Wpisz kod dostępu otrzymany od organizatora kursu, aby rozpocząć przygotowanie do egzaminu teoretycznego.",

  homeTitle:
    getEnvText(import.meta.env.VITE_HOME_TITLE) ?? "Próbne egzaminy żeglarskie",

  homeDescription:
    getEnvText(import.meta.env.VITE_HOME_DESCRIPTION) ??
    "Wybierz egzamin udostępniony przez organizatora kursu i sprawdź swoją wiedzę przed właściwym testem.",
};

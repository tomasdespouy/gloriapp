/**
 * Pantalla intermedia del enlace de recuperación.
 *
 * Esta página NO canjea el token: solo lo muestra en un formulario. El canje
 * ocurre en POST /api/auth/confirm, cuando la persona aprieta el botón.
 *
 * El motivo es concreto: el token es de un solo uso, y los escáneres de
 * seguridad de los correos institucionales abren cada enlace del mensaje para
 * revisarlo. Cuando el canje vivía en el GET, esa visita automática quemaba el
 * token y la persona recibía "el enlace expiró o ya fue usado" al hacer clic.
 * Un escáner hace GET; no envía un formulario.
 */
export default async function ConfirmarEnlacePage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash: tokenHash, type, next } = await searchParams;

  const invalido = !tokenHash || !type;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FAFAFA",
        padding: "24px",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#1A1A1A",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#FFFFFF",
          border: "1px solid #E5E5E5",
          borderRadius: "16px",
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/gloria-logo.png"
          alt="GlorIA"
          style={{ height: "44px", width: "auto", margin: "0 auto 24px", display: "block" }}
        />

        {invalido ? (
          <>
            <h1 style={{ fontSize: "19px", fontWeight: 600, margin: "0 0 10px" }}>
              Este enlace no es válido
            </h1>
            <p style={{ fontSize: "14px", color: "#55555F", lineHeight: 1.6, margin: "0 0 24px" }}>
              Puede que esté incompleto. Pide uno nuevo y vuelve a intentarlo.
            </p>
            <a
              href="/forgot-password"
              style={{
                display: "block",
                background: "#4A55A2",
                color: "#FFFFFF",
                padding: "13px",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Pedir un enlace nuevo
            </a>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "19px", fontWeight: 600, margin: "0 0 10px" }}>
              Crea tu nueva contraseña
            </h1>
            <p style={{ fontSize: "14px", color: "#55555F", lineHeight: 1.6, margin: "0 0 24px" }}>
              Presiona el botón para continuar. Te pedimos este paso para que el enlace siga
              siendo válido cuando llegues tú y no antes.
            </p>

            <form method="POST" action="/api/auth/confirm">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next || "/reset-password"} />
              <button
                type="submit"
                style={{
                  width: "100%",
                  background: "#4A55A2",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "13px",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continuar
              </button>
            </form>

            <p style={{ fontSize: "12.5px", color: "#86868F", lineHeight: 1.6, margin: "20px 0 0" }}>
              El enlace sirve una sola vez. Si ya lo usaste,{" "}
              <a href="/forgot-password" style={{ color: "#4A55A2" }}>
                pide uno nuevo
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}

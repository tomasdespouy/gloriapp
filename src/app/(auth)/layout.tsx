export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Left Panel — Photo + overlay text */}
        <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
          {/* Background image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/login-bg.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1425]/90 via-[#0B1425]/40 to-[#0B1425]/20" />

          <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            {/* Logo UGM */}
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/ugm-logo.png" alt="Universidad Gabriela Mistral" className="h-14 w-auto" />
            </div>

            {/* Spacer */}
            <div />

            {/* Text over photo — bottom */}
            <div className="space-y-5 max-w-lg">
              <p className="text-white text-lg leading-relaxed font-medium drop-shadow-md">
                Filmado en 1965 por el Dr. Shostrom, el caso{" "}
                <strong>Gloria</strong> muestra a tres psicoterapeutas pioneros:
                Carl Rogers, Fritz Perls y Albert Ellis, comparando sus enfoques.
              </p>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-4 max-w-md">
                <p className="text-white/90 text-sm leading-relaxed font-medium">
                  Inspirados en esta experiencia, nace GlorIA, plataforma de
                  aprendizaje para el desarrollo de competencias clínicas,
                  basada en Inteligencia Artificial.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — Form */}
        <div className="flex-1 flex items-center justify-center bg-white px-6">
          <div className="w-full max-w-sm animate-fade-in">{children}</div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0B1425] text-white/50 text-xs text-center py-3 px-4 flex items-center justify-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/ugm-logo.png" alt="Universidad Gabriela Mistral" className="h-5 w-auto opacity-70" />
        <span>&mdash; 2026. Todos los derechos reservados.</span>
      </footer>
    </div>
  );
}

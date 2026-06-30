export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Left Panel — Editorial photo with brand grade */}
        <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
          {/* Background image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/login-bg.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Indigo brand grade — tiñe la foto sin apagarla */}
          <div
            className="absolute inset-0 mix-blend-multiply"
            style={{
              background:
                "radial-gradient(120% 120% at 30% 20%, rgba(74,85,162,0.10), transparent 55%), linear-gradient(180deg, rgba(74,85,162,0.18) 0%, rgba(11,20,37,0.12) 40%, rgba(11,20,37,0.92) 100%)",
            }}
          />
          {/* Dark veil — legibilidad del texto */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1425]/90 via-[#0B1425]/30 to-transparent" />

          <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            {/* Logo UGM */}
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/ugm-logo.png"
                alt="Universidad Gabriela Mistral"
                className="h-14 w-auto drop-shadow-lg"
              />
            </div>

            {/* Spacer */}
            <div />

            {/* Editorial — bottom */}
            <div className="max-w-lg">
              {/* Kicker */}
              <div className="flex items-center gap-2.5 mb-4">
                <span className="h-px w-8 bg-[#C7CBE5]/60" />
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#C7CBE5]">
                  El caso Gloria · 1965
                </span>
              </div>

              <p className="text-white text-2xl leading-snug font-medium tracking-tight drop-shadow-md">
                Filmado por el Dr. Shostrom, el caso{" "}
                <strong className="font-extrabold">Gloria</strong> reunió a tres
                psicoterapeutas pioneros comparando sus enfoques.
              </p>

              {/* Pioneros */}
              <div className="flex flex-wrap gap-2.5 mt-5 mb-6">
                {["Carl Rogers", "Fritz Perls", "Albert Ellis"].map((n) => (
                  <span
                    key={n}
                    className="text-[12.5px] font-semibold text-white px-3.5 py-1.5 rounded-full border border-white/25 bg-white/[0.07] backdrop-blur-sm"
                  >
                    {n}
                  </span>
                ))}
              </div>

              {/* Glass card */}
              <div className="bg-white/[0.09] backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 max-w-md shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_40px_rgba(0,0,0,0.25)]">
                <p className="text-white/90 text-sm leading-relaxed font-medium">
                  Inspirados en esa experiencia, nace{" "}
                  <strong className="font-bold">GlorIA</strong>, plataforma de
                  aprendizaje para el desarrollo de competencias clínicas, basada
                  en Inteligencia Artificial.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — Floating form card */}
        <div
          className="flex-1 flex items-center justify-center px-6 py-10"
          style={{
            background:
              "radial-gradient(120% 80% at 100% 0%, rgba(74,85,162,0.06), transparent 60%), #FAFAFA",
          }}
        >
          <div className="w-full max-w-md bg-white border border-[#E5E5E5] rounded-3xl px-9 py-11 shadow-[0_24px_60px_-28px_rgba(11,20,37,0.18)] animate-fade-in">
            {children}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0B1425] text-white/50 text-xs text-center py-3 px-4 flex items-center justify-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/ugm-logo.png"
          alt="Universidad Gabriela Mistral"
          className="h-5 w-auto opacity-70"
        />
        <span>&mdash; 2026. Todos los derechos reservados.</span>
      </footer>
    </div>
  );
}

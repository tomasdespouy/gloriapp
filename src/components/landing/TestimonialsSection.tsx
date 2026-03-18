import { Quote } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

interface TestimonialsSectionProps {
  dict: Record<string, string>;
}

export default function TestimonialsSection({ dict }: TestimonialsSectionProps) {
  const t = (key: string) => dict[key] || key;
  const testimonials = [
    {
      quote: t("testimonials.quote1"),
      name: t("testimonials.name1"),
      year: t("testimonials.year1"),
      career: t("testimonials.career1"),
    },
    {
      quote: t("testimonials.quote2"),
      name: t("testimonials.name2"),
      year: t("testimonials.year2"),
      career: t("testimonials.career2"),
    },
    {
      quote: t("testimonials.quote3"),
      name: t("testimonials.name3"),
      year: t("testimonials.year3"),
      career: t("testimonials.career3"),
    },
  ];

  return (
    <section
      id="testimonios"
      className="py-12 lg:py-16"
      style={{
        background: "linear-gradient(135deg, #4A55A2 0%, #354080 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              {t("testimonials.title")}
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto">
              {t("testimonials.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {testimonials.map((item, i) => (
            <ScrollReveal key={item.name} delay={i * 100}>
              <div className="bg-white rounded-xl p-6 shadow-lg h-full flex flex-col">
                <Quote size={24} className="text-[#4A55A2]/30 mb-3" />
                <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-4">
                  {item.quote}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#4A55A2]/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#4A55A2]">
                      {item.name.split(" ").map((n) => n[0]).join("")}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.year} &middot; {item.career}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

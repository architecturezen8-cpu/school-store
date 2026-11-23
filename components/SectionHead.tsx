import Reveal from "@/components/Reveal";

type SectionHeadProps = {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
};

export default function SectionHead({
  eyebrow,
  title,
  sub,
  align = "center",
}: SectionHeadProps) {
  const centered = align === "center";
  return (
    <Reveal
      className={
        centered
          ? "flex flex-col items-center text-center"
          : "flex flex-col items-start text-left"
      }
    >
      <span className="flex items-center gap-3">
        <span className="h-px w-8 bg-gold/60" />
        <span className="text-[11px] font-bold uppercase tracking-[0.4em] text-gold">
          {eyebrow}
        </span>
        <span className="h-px w-8 bg-gold/60" />
      </span>
      <h2 className="mt-5 font-display text-[1.9rem] font-semibold leading-[1.12] tracking-tight md:text-4xl lg:text-[2.85rem]">
        {title}
      </h2>
      {sub && (
        <p
          className={`mt-4 max-w-xl text-sm leading-relaxed text-white/50 md:text-[15px] ${
            centered ? "mx-auto" : ""
          }`}
        >
          {sub}
        </p>
      )}
    </Reveal>
  );
}

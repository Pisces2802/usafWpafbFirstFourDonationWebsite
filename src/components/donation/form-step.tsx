import type { ReactNode } from "react";

type FormStepProps = {
  id: string;
  step: number;
  title: ReactNode;
  children: ReactNode;
};

/** A numbered card for one step of the /donate form; the number is decorative, the h2 carries it. */
export const FormStep = ({ id, step, title, children }: FormStepProps) => (
  <section
    aria-labelledby={id}
    className="bg-card text-card-foreground ring-foreground/10 rounded-xl p-5 ring-1 sm:p-8"
  >
    <h2 id={id} className="font-condensed flex items-center gap-3 text-2xl sm:text-3xl">
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full font-sans text-base font-bold tabular-nums"
      >
        {step}
      </span>
      {title}
    </h2>
    <div className="mt-6 flex flex-col gap-6">{children}</div>
  </section>
);

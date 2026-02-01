"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is my data safe?",
    answer:
      "Your data is encrypted with bank-grade security and stored on Australian servers. We connect to your bank via Basiq open banking — we never see or store your login credentials.",
  },
  {
    question: "Which banks are supported?",
    answer:
      "All major Australian banks including CBA, NAB, ANZ, and Westpac, plus 100+ other institutions via open banking.",
  },
  {
    question: "Can my accountant access my data?",
    answer:
      "Yes. Export ATO-ready reports anytime, or invite your accountant for read-only access on the Team plan.",
  },
  {
    question: "Does it work with trusts and SMSFs?",
    answer:
      "Yes. We support personal ownership, family trusts, unit trusts, companies, and self-managed super funds.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. No lock-in contracts. Cancel anytime and keep access until your billing period ends.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. Track one property free forever with bank feeds and basic tax categories. Upgrade to Pro when you're ready.",
  },
  {
    question: "What's the lifetime deal?",
    answer:
      "Pay $249 once for permanent Pro access — no ongoing fees. Limited to our first 100 founding members.",
  },
];

export function FaqSection() {
  return (
    <section className="py-12 md:py-20 px-4 bg-secondary">
      <div className="container mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-4">
          Frequently asked questions
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Everything you need to know about PropertyTracker.
        </p>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

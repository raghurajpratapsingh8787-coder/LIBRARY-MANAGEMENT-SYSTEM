import type { Variants } from 'motion/react';

export const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: easeOutCurve },
  },
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: easeOutCurve } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: easeOutCurve } },
  exit: { opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.12 } },
};

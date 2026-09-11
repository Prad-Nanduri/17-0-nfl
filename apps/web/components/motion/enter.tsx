'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { motionTokens } from '../../lib/motion';

/** A short entrance establishes hierarchy without hiding content from reduced-motion users. */
export function Enter({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={false}
      whileInView={reduce ? {} : { y: [10, 0], opacity: [0.7, 1] }}
      viewport={{ once: true }}
      transition={{ duration: motionTokens.enter, ease: [...motionTokens.ease] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

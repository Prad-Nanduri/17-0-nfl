'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { memo, type ReactNode } from 'react';
import { motionTokens } from '../../lib/motion';

export interface CardFlipRevealProps {
  front: ReactNode;
  back: ReactNode;
  revealed: boolean;
  label: string;
  className?: string;
  onFlipComplete?: () => void;
}

/** Controlled visual reveal: keep its trigger outside; hidden faces are inert and aria-hidden. */
export const CardFlipReveal = memo(function CardFlipReveal({
  front,
  back,
  revealed,
  label,
  className = '',
  onFlipComplete,
}: CardFlipRevealProps) {
  const reduce = useReducedMotion();
  return (
    <div
      role="group"
      aria-label={label}
      className={className}
      style={{ perspective: motionTokens.perspective }}
    >
      <motion.div
        initial={false}
        animate={{ rotateY: reduce ? 0 : revealed ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : motionTokens.flip}
        {...(onFlipComplete ? { onAnimationComplete: onFlipComplete } : {})}
        className="flip-scene grid h-full"
      >
        <div
          aria-hidden={revealed}
          ref={(node) => {
            if (node) node.inert = revealed;
          }}
          className={`flip-face col-start-1 row-start-1 h-full ${reduce && revealed ? 'invisible' : ''}`}
        >
          {front}
        </div>
        <div
          aria-hidden={!revealed}
          ref={(node) => {
            if (node) node.inert = !revealed;
          }}
          className={`flip-face col-start-1 row-start-1 h-full ${reduce ? (revealed ? '' : 'invisible') : 'flip-back'}`}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
});

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const slides = [
  { text: "Hi Nadine",                          emoji: "💜", size: 56 },
  { text: "I heard you were\nhaving an off day", emoji: "☁️", size: 30 },
  { text: "I just wanted to say\nI miss you lots", emoji: "🫂", size: 30 },
  { text: "And I'm super excited\nto see you tomorrow", emoji: "✨", size: 27 },
  { text: "I hope you\nfeel better",             emoji: "🌸", size: 38 },
  { text: "And don't forget that\nyou're super cool,", emoji: "😎", size: 27 },
  { text: "sweet,",                              emoji: "🍭", size: 58 },
  { text: "silly",                               emoji: "🙃", size: 64 },
  { text: "and awesome",                         emoji: "⭐", size: 50 },
];

const variants = {
  enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center:        { x: 0, opacity: 1 },
  exit:  (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 }),
};

export default function NadinePage() {
  const [[idx, dir], setSlide] = useState([0, 0]);
  const [interacted, setInteracted] = useState(false);
  const isDragging = useRef(false);

  const go = (newDir) => {
    const next = idx + newDir;
    if (next >= 0 && next < slides.length) {
      setSlide([next, newDir]);
      setInteracted(true);
    }
  };

  const handleDragEnd = (_, info) => {
    const dragged = Math.abs(info.offset.x) > 48;
    if (dragged) {
      isDragging.current = true;
      if (info.offset.x < 0) go(1);
      else go(-1);
      requestAnimationFrame(() => { isDragging.current = false; });
    }
  };

  const handleClick = () => {
    if (!isDragging.current) go(1);
  };

  const slide = slides[idx];
  const isLast = idx === slides.length - 1;

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(160deg, #e9d5ff 0%, #a855f7 45%, #6d28d9 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* soft blobs */}
      <div style={{
        position: 'absolute', width: 380, height: 380, borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)', top: -110, right: -110,
        filter: 'blur(70px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(255,255,255,0.09)', bottom: -90, left: -90,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      {/* slide */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={idx}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 44px',
            textAlign: 'center',
            maxWidth: 400,
            width: '100%',
          }}
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 380, damping: 22 }}
            style={{ fontSize: 76, lineHeight: 1, marginBottom: 28 }}
          >
            {slide.emoji}
          </motion.div>

          <motion.div
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.38 }}
            style={{
              fontSize: slide.size,
              fontWeight: 800,
              color: 'white',
              lineHeight: 1.25,
              whiteSpace: 'pre-line',
              textShadow: '0 4px 32px rgba(109,40,217,0.5)',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              letterSpacing: '-0.025em',
            }}
          >
            {slide.text}
          </motion.div>

          {isLast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55, type: 'spring' }}
              style={{
                marginTop: 36,
                fontSize: 28,
                letterSpacing: 4,
              }}
            >
              💜💜💜
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* progress dots */}
      <div style={{
        position: 'absolute',
        bottom: 54,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
      }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            width: i === idx ? 22 : 7,
            height: 7,
            borderRadius: 4,
            background: i === idx ? 'white' : 'rgba(255,255,255,0.33)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* tap hint — fades out after first interaction */}
      <AnimatePresence>
        {!interacted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 1.4, duration: 0.5 }}
            style={{
              position: 'absolute',
              bottom: 98,
              color: 'rgba(255,255,255,0.52)',
              fontSize: 13,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              letterSpacing: '0.06em',
              pointerEvents: 'none',
            }}
          >
            tap or swipe →
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

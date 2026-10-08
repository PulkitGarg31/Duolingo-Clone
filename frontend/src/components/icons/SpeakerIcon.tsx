import { arcPath } from "./geometry";
import { LINE, SvgIcon, type IconProps } from "./Icon";

const BODY =
  "M3.6 8.8H6.8L10.6 5.3C11.4 4.6 12.6 5.2 12.6 6.2V17.8C12.6 18.8 11.4 19.4 10.6 18.7L6.8 15.2H3.6" +
  "C2.7 15.2 2 14.5 2 13.6V10.4C2 9.5 2.7 8.8 3.6 8.8Z";
const WAVES = [3.4, 6.4, 9.4].map((radius) => arcPath(12.6, 12, radius, -45, 45));

// While audio plays the waves light up one after another, 200 ms each. The negative delays start every wave
// at its own point of the 600 ms cycle; under reduced motion the global rule cuts the animation to nothing.
const WAVE_KEYFRAMES = "@keyframes icon-speaker-wave{0%,33%{opacity:1}34%,100%{opacity:.35}}";
const WAVE_ANIMATION = "icon-speaker-wave 600ms linear infinite";
const WAVE_DELAYS = ["0ms", "-400ms", "-200ms"];

/** Speaker (play audio): a rounded speaker with three sound waves (`currentColor`), animated while `playing`. */
export function SpeakerIcon({ playing = false, ...props }: IconProps & { playing?: boolean }) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      {playing ? <style>{WAVE_KEYFRAMES}</style> : null}
      <path d={BODY} fill="currentColor" />
      {WAVES.map((d, i) => (
        <path
          key={d}
          d={d}
          {...LINE}
          strokeWidth={2}
          style={playing ? { animation: WAVE_ANIMATION, animationDelay: WAVE_DELAYS[i] } : undefined}
        />
      ))}
    </SvgIcon>
  );
}

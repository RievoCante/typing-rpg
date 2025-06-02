// import React, {
//   createContext,
//   useState,
//   useContext,
//   useEffect,
//   useCallback,
//   useRef,
// } from "react";

// // Add type declaration for legacy browser support
// interface WindowWithWebkitAudio extends Window {
//   webkitAudioContext?: typeof AudioContext;
// }

// interface CustomAudio extends HTMLAudioElement {
//   playFallback?: () => void;
// }

// interface AudioContextType {
//   isMuted: boolean;
//   toggleMute: () => void;
//   playSound: (type: "keypress" | "hit" | "defeat") => void;
// }

// const AudioContext = createContext<AudioContextType | undefined>(undefined);

// export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({
//   children,
// }) => {
//   const [isMuted, setIsMuted] = useState(() => {
//     const savedMute = localStorage.getItem("isMuted");
//     return savedMute === "true";
//   });

//   // Use a ref to track the latest value of isMuted
//   const isMutedRef = useRef(isMuted);

//   // Keep the ref updated with the latest value
//   useEffect(() => {
//     isMutedRef.current = isMuted;
//   }, [isMuted]);

//   const [sounds, setSounds] = useState<Record<string, CustomAudio>>({});

//   useEffect(() => {
//     // Preload sounds
//     const soundMap: Record<string, CustomAudio> = {
//       keypress: new Audio("/sounds/keypress.mp3") as CustomAudio,
//       hit: new Audio("/sounds/hit.mp3") as CustomAudio,
//       defeat: new Audio("/sounds/defeat.mp3") as CustomAudio,
//     };

//     // Use default sounds if files don't exist
//     Object.keys(soundMap).forEach((key) => {
//       soundMap[key].onerror = () => {
//         console.warn(`Sound file for ${key} not found, using fallback`);
//         // Create oscillator for fallback sounds
//         const audioContext = new (window.AudioContext ||
//           (window as WindowWithWebkitAudio).webkitAudioContext ||
//           AudioContext)();

//         soundMap[key] = new Audio() as CustomAudio;

//         // Different frequencies for different sound types
//         let frequency = 440; // Default A4
//         if (key === "keypress") frequency = 523.25; // C5
//         if (key === "hit") frequency = 659.25; // E5
//         if (key === "defeat") frequency = 783.99; // G5

//         // Store audio data for later use
//         (soundMap[key] as CustomAudio).playFallback = () => {
//           if (isMutedRef.current) return;

//           const oscillator = audioContext.createOscillator();
//           const gainNode = audioContext.createGain();

//           oscillator.type = "sine";
//           oscillator.frequency.setValueAtTime(
//             frequency,
//             audioContext.currentTime
//           );

//           gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
//           gainNode.gain.exponentialRampToValueAtTime(
//             0.01,
//             audioContext.currentTime + 0.5
//           );

//           oscillator.connect(gainNode);
//           gainNode.connect(audioContext.destination);

//           oscillator.start();
//           oscillator.stop(audioContext.currentTime + 0.5);
//         };
//       };

//       // Set volume
//       soundMap[key].volume = key === "keypress" ? 0.2 : 0.5;
//     });

//     setSounds(soundMap);

//     return () => {
//       // Cleanup
//       Object.values(soundMap).forEach((sound) => {
//         sound.pause();
//         sound.src = "";
//       });
//     };
//   }, []);

//   useEffect(() => {
//     localStorage.setItem("isMuted", isMuted.toString());
//   }, [isMuted]);

//   const toggleMute = () => {
//     setIsMuted((prev) => !prev);
//   };

//   const playSound = useCallback(
//     (type: "keypress" | "hit" | "defeat") => {
//       if (isMuted || !sounds[type]) return;

//       // Use fallback if available
//       const soundObj = sounds[type] as CustomAudio;
//       if (
//         soundObj.playFallback &&
//         typeof soundObj.playFallback === "function"
//       ) {
//         soundObj.playFallback();
//         return;
//       }

//       // Clone the audio to allow multiple sounds at once
//       const sound = sounds[type].cloneNode() as HTMLAudioElement;
//       sound.volume = type === "keypress" ? 0.2 : 0.5;
//       sound.play().catch((err) => console.warn("Audio play failed:", err));
//     },
//     [isMuted, sounds]
//   );

//   return (
//     <AudioContext.Provider value={{ isMuted, toggleMute, playSound }}>
//       {children}
//     </AudioContext.Provider>
//   );
// };

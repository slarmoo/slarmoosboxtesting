Some super basic documentation for the synth folder

# [Deque.ts](./Deque.ts)
A Deque implentation made for handling BeepBox's synth tones. 
More information about deques can be found [here](https://www.geeksforgeeks.org/javascript/deque-in-javascript/)

# [FFT.ts](./FFT.ts)
All of the code from BeepBox's implementation of a fast fourier transform. 
More information about fast fourier transforms can be found [here](https://en.wikipedia.org/wiki/Fast_Fourier_transform)

# [filtering.ts](./filtering.ts)
Much of the code for BeepBox's filtering system. BeepBox uses Dynamic Biquad Filters. John Nesky links a lot of helpful information in the comments of the file

# [Set.ts](./Set.ts)
A Set implementation made for handling Slarmoo's Box's live input tones. While sets, unlike deques, natively exist in javascript, this set has been specially optimized for Slarmoo's Box

# [synth.ts](./synth.ts)
Where all of the synthesis occurs. While in previous versions / mods this was directly accessible to outside files (such as in the editor), in order to update to using AudioWorkletNode the synth is now only directly accessible through synthMessenger.ts (only for exporting) and synthProcessor.ts

# [synthConfig.ts](./SynthConfig.ts)
All of the config information for the synth. Much of the editor and synth references these values.

# [synthMessages.ts](./synthMessages.ts)
Also a config file, but specifically for message commands to send the AudioWorkletNode synth

# [synthMessenger.ts](./synthMessenger.ts)
The main thread intermediary between the editor and the synth. Handles the actual sending of messages to the synth thread, the declarations for different data structures like Songs or Instruments, and the mod channel information needed for the editor to display

# [synthProcessor.ts](./synthProcessor.ts)
The entry point for the AudioWorkletNode. It handles the receiving of messages from the main thread, and sending any messages if needed. 
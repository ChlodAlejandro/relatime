# Custom hooks
If you want to add in custom functionality to the bot without modifying the core code, you can add your own hooks here.
Create a new TypeScript file in this directory matching the name of the event you want to hook into (e.g.,
`onMessageCreate.ts` for the `messageCreate` event). The file should export a default function that takes the same
parameters as the event handler. If event processing must stop, return `false` from the function.

This hook will automatically be imported and registered when the bot starts.

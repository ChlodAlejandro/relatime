# relatime
Converts relative time in chat to Discord timestamps based on the user's timezone.

## Features
- Converts relative time expressions (e.g., "in 5 minutes", "tomorrow at 3 pm")
- Converts absolute time expressions (e.g., "9pm", "tomorrow at 3 pm")
- Supports **English only**
- Supports per-user timezones

## To-do
- [ ] Support for more specific dates (e.g., "August 12 at 3 a.m.") 

## Usage
You can run the bot as a Docker container. Data is stored in the `/app/data` directory.
```bash
docker pull ghcr.io/ChlodAlejandro/relatime:latest
docker run -d --name relatime \
    --mount "type=bind,src=./data,dst=/app/data" \
    -e RT_DISCORD_CLIENT_ID=your_id_here \
    -e RT_DISCORD_TOKEN=your_token_here \
    --restart unless-stopped \
    ghcr.io/ChlodAlejandro/relatime:latest
```

You can also clone the repository and run it with `ts-node`.
```bash
git clone https://github.com/chlodalejandro/relatime.git
cd relatime
npm install
npm run start
```

## License
Apache License 2.0. See [LICENSE](LICENSE) for more information.
```
Copyright 2025 Chlod Alejandro

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

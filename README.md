# Helix

Helix is an intellectual and free AI platform put out to the public. It is heavily inspired by Claude and ChatGPT.

Try the demo here: [https://helix.erikku.page](https://helix.erikku.page)

![helix_web_app_screenshot](images/Screenshot%202026-10-19%20161117.png)

* multiple L L models
* mongodb support
* markdown support
* tool calling (agenti-cism)
    * only `web_search` tool is currently available!
* central system prompt (change it in `PROMPT.md`!)
    * the Fast and Intellect models can in fact go `UwU` or `OwO`, whatever you want while still being smart

## Configurations

```env
JWT_SECRET=...
MONGO_URI=mongodb://...
SEARXNG_URI=http://...
```

Yeah, that's all the env params. I won't go into detail about what these mean, they're self-explanatory with how they're used. `SEARXNG_URI` is optional, it's used for the web tools, but the rest isn't though.

## Credits

Icons were used from:

* Slack's Block Kit Builder (because I really liked the check mark and warning SVGs from when I was working on [jae](https://github.com/JustAnEric/jae))
* [Hack Club iconset](https://icons.hackclub.com/) (they provided me with a new chat button icon)

**This is only a MVP (minimum-viable product) and it should absolutely not be taken as a finished project.**
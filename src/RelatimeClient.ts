import { Client, ClientOptions } from "discord.js";

export default class RelatimeClient extends Client {

    id: string;

    constructor(options: ClientOptions) {
        super(options);

        if (this.shard?.ids) {
            this.id = "s/" + this.shard?.ids.join("/");
        } else {
            this.id = "c/0";
        }
    }

}

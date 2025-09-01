import Keyv from "keyv";

// noinspection SpellCheckingInspection
const keyv = new Keyv(null);

export default function getKeyv() {
    return keyv;
}

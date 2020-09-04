/**
 * A bit of a null-pattern kinda thing.
 * When asked to react(), doesn't do anything.
 */
class DefaultPayloadReacter {
  react() {
    // these guys don't react! they're just not that type.....
  }
}

module.exports = DefaultPayloadReacter;

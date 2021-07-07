export function registerSelectAction(track, instance, element, trackParams) {
  track.dispatch.on('mouseclick', (d) => {
    trackParams.selectAction(d);
  });
}

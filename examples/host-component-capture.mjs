import {expect} from '@playwright/test';

/** Responsive layout/fit is asynchronous. A root width alone cannot prove its graph is visible. */
export async function captureHostComponent(frame, width, file) {
  const root = frame.locator('.semantic-root');
  await root.evaluate((el, width) => {el.style.width = width + 'px'; el.style.maxWidth = '100%';}, width);
  await expect.poll(() => root.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  const graph = frame.locator('.react-flow');
  let graphGeometry = null;
  if (await graph.count()) {
    await frame.getByRole('button', {name: '显示全部节点和关系', exact: true}).click();
    await expect.poll(async () => {
      const viewport = await graph.boundingBox(), nodes = await graph.locator('.react-flow__node').all();
      if (!viewport || !nodes.length) return false;
      const boxes = await Promise.all(nodes.map(node => node.boundingBox()));
      return boxes.every(b => b && b.x >= viewport.x - 1 && b.y >= viewport.y - 1 &&
        b.x + b.width <= viewport.x + viewport.width + 1 && b.y + b.height <= viewport.y + viewport.height + 1);
    }).toBe(true);
    graphGeometry = {viewport: await graph.boundingBox(), nodes: await Promise.all((await graph.locator('.react-flow__node').all()).map(node => node.boundingBox())), allNodesInside: true};
  }
  const plot = frame.locator('.plot');
  if (await plot.count()) {
    await expect.poll(async () => {
      const viewport = await plot.boundingBox(), surface = await plot.locator('svg, canvas').first().boundingBox();
      return !!viewport && !!surface && Math.abs(viewport.width - surface.width) <= 1;
    }).toBe(true);
  }
  const geometry = await root.boundingBox();
  await expect.poll(async () => Math.abs((await root.boundingBox()).width - width)).toBeLessThanOrEqual(1);
  await root.screenshot({path: file});
  return {width, actualWidth: geometry.width, noRootOverflow: true, graphGeometry, plotResized: !!await plot.count()};
}

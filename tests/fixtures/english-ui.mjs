/** Legacy suites assert English copy explicitly; product defaults remain Chinese. */
export async function englishUI(page){await page.evaluate(()=>{localStorage.setItem('dsh-semantic-ui.locale.v1','en');window.dispatchEvent(new CustomEvent('dsh-semantic-ui:locale',{detail:'en'}));});}

import {it,expect} from 'vitest';
import {numericRequest} from '../fixtures/source-numeric';
import {chartFacts} from '../src/facts';
import {chartView} from '../src/chart-view';
import {defaultTheme,themeTokens} from '../src/theme';
const payload=(values:(number|null)[],id:string)=>{
 const p=numericRequest(values,'电流','毫安',id).view.payload;if(p.chartType==='histogram')throw Error('Expected positional data');return p;
};

it('computes a nonempty all-zero hypothesis while leaving all original readings and real statistics unknown',()=>{
 const p=payload([null,null,null],'all-missing'),before=JSON.stringify(p),f=chartFacts(p);
 if(f.chartType==='histogram')throw Error();
 expect(f.series[0]).toMatchObject({valid:0,missing:3,sum:null,mean:null,zeroFillIllustration:{count:3,sum:0,mean:0,
  differenceFromObservedSum:null,differenceFromObservedMean:null,directionRelativeToObservedSum:'unknown',directionRelativeToObservedMean:'unknown',completeDataSumKnown:false,completeDataMeanKnown:false}});
 expect(JSON.stringify(p)).toBe(before);expect(p.rows.map(r=>Object.values(r.values)[0])).toEqual([null,null,null]);
});

it('uses the selected table population for an all-missing slice, retains null export, and leaves an empty range undefined',()=>{
 const p=payload([4,null,-4],'slice'),before=JSON.stringify(p),id=p.series[0].id,tokens=themeTokens(defaultTheme);
 const selection={enabled:[id],from:1,to:1,scope:'filtered' as const},slice=chartView(p,selection,tokens);
 expect(slice.zeroFillComparison).toMatchObject({scope:'filtered-source-rows',rowCount:1,series:[{valid:0,missing:1,sum:null,mean:null,zeroFillIllustration:{count:1,sum:0,mean:0,directionRelativeToObservedMean:'unknown'}}]});
 expect(slice.download.rows).toEqual([['2',null]]);
 const all=chartView(p,{...selection,scope:'all'},tokens).zeroFillComparison!;
 expect(all).toMatchObject({scope:'all-source-rows',rowCount:3,series:[{valid:2,missing:1,mean:0,zeroFillIllustration:{mean:0,sum:0,directionRelativeToObservedMean:'same'}}]});
 const empty=chartView(p,{...selection,from:2,to:0},tokens).zeroFillComparison!;
 expect(empty).toMatchObject({rowCount:0,series:[{valid:0,missing:0,mean:null,zeroFillIllustration:{count:0,mean:null,sum:null}}]});
 expect(JSON.stringify(p)).toBe(before);
});

it('does not turn arithmetic overflow or an empty source into a zero result',()=>{
 for(const values of [[Number.MAX_VALUE,Number.MAX_VALUE,null],[]]){
  const p=payload(values,'unavailable'),f=chartFacts(p);if(f.chartType==='histogram')throw Error();
  expect(f.series[0]).toMatchObject({sum:null,mean:null,zeroFillIllustration:{sum:null,mean:null,differenceFromObservedMean:null,directionRelativeToObservedMean:'unknown'}});
 }
});

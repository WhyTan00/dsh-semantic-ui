import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { components } from './protocol';
export const catalog=defineCatalog(schema,{
  components:{
    ArchitectureExplorer:{props:components.ArchitectureExplorer,description:'Explore declared relationships, responsibilities and valid scenario paths.',slots:[]},
    DecisionExplorer:{props:components.DecisionExplorer,description:'Compare common dimensions and explain deterministic conditional recommendations.',slots:[]},
    DataChart:{props:components.DataChart,description:'Inspect numeric trends, categories or explicitly binned distributions and their source data.',slots:[]},
  }, actions:{},
});

import * as _ from 'lodash';

export interface GeneratorConfig {
  outputPath: string;
  paths: string[];
  tsConfigFilePath?: string;
  extraImports?: Import[];
  providedIn?: string;
  serviceName?: string;
  whiteListDecorators?: string[];
  apiBase?: string;
}

export interface Import {
  defaultImport?: string;
  namespaceImport?: string;
  namedImports?: string[];
  moduleSpecifier: string;
}

const defaultConfig: GeneratorConfig = {
  outputPath: null,
  paths: [],
  extraImports: [],
  serviceName: 'ApiService',
  providedIn: `'root'`,
  apiBase: '/api',
  tsConfigFilePath: './tsconfig.json',
  whiteListDecorators: ['Body', 'Param', 'Query', 'UploadedFile'],
};

let config: GeneratorConfig;

export const ConfigHelper = {
  mergeUserConfig(userConfig: GeneratorConfig) {
    // deep merge
    config = _.mergeWith(defaultConfig, userConfig, (a: any, b: any) => {
      if (_.isArray(a)) {
        return a.concat(b);
      }

      // fallback to default merge
      return undefined;
    });

    if (!config.outputPath) {
      throw new Error('You must provide an `outputPath`');
    }

    if (!config.paths || config.paths.length === 0) {
      throw new Error('You must provide at least one path in `paths`');
    }

    return this;
  },

  get(): GeneratorConfig {
    return config;
  },
};

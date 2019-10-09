# Automatic Nest SDK Generator

A helpful tool for automatically generating a client-side SDK (currently only in Angular) from NestJS Controllers.

## Config

Create a file in your project's root: `nest-sdk-gen.config.json`. **All paths must be relative to the location of this file!**

Example Config:

```json
{
  "$schema": "./node_modules/@matchbook-lab/nest-sdk-generator/config.schema.json",
  "config": {
    "outputPath": "./client/app/services/api/api.service.ts",
    "tsConfigFiledPath": "./server/tsconfig.server.json",
    "paths": [
      "./server/api/**/*.controller.ts"
    ]
  }
}
```

`.config.paths` supports any patterns supported by [globby](https://github.com/sindresorhus/globby).

Full Config Model:

```ts
export interface GeneratorConfig {
  // these are required
  outputPath: string;
  paths: string[];

  
  tsConfigFilePath?: string; // defaults to `./tsconfig.json`
  extraImports?: Import[]; // extra imports only needed to reconcile import conflicts
  providedIn?: string; // Angular @Injector() value defaults to `'root'`. `null` for no param.
  serviceName?: string; // Name of the service that is created
  whiteListDecorators?: string[]; // is merged with `['Param', 'Body', 'Query', 'UploadedFile']`. Everything else is ignored 
  apiBase?: string; // defaults to: `/api`. Base path of your API.
}

export interface Import {
  defaultImport?: string;
  namespaceImport?: string;
  namedImports?: string[];
  moduleSpecifier: string;
}
``` 

When run, it will take this:

```ts
@Controller('courses')
export class CourseController {
  @Get(':id')
  async findCourse(
    @Param('id') id: number | string,
    @Query('includeInactive') includeInactive: boolean = false,
    @LoggedInUser() user?: User,
  ): Promise<Course> {
    // controller body
  }
}
```

and create an Angular service:

```ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(protected httpClient: HttpClient) {}

  async findCourse(id: number | string, includeInactive: boolean = false): Promise<Course> {
    return this.httpClient
      .get<Course>(`/api/courses/${id}`, { params: this.parametrize({ includeUserCourses }) })
      .toPromise();
  }

  // ...
}
```

## Features

* Strips out extra params, i.e. custom "AuthenticatedUser" decorators
* Supports overloads
* Initial file support
* Automatically resolve imports
* More stuff as I remember to document it...

More docs coming soon!

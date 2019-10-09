#!/usr/bin/env node

import { ValidateFunction } from 'ajv';
import * as findUp from 'find-up';
import * as globby from 'globby';
import * as Ajv from 'ajv';
import * as path from 'path';
import * as _ from 'lodash';
import {
  ClassDeclaration,
  ClassDeclarationStructure,
  DecoratorStructure,
  IndentationText,
  MethodDeclarationStructure,
  NewLineKind,
  OptionalKind,
  Project,
  QuoteKind,
  Scope,
  SourceFile,
} from 'ts-morph';
import { createBody } from './body-builder';
import { ConfigHelper, GeneratorConfig } from './config';
import { commentHeader, removeParameterDecorators, removeUnsupportedParams, unwrapQuotes } from './util';

const configFileName = 'nest-sdk-gen.config.json';

(async () => {
  const configPath = await findUp(configFileName);
  if (!configPath) {
    throw new Error(`Could not find ${configFileName}. You must create one. See the docs`);
  }

  const configFileContents: { config: GeneratorConfig } = await import(configPath);
  // @ts-ignore
  const configSchema: any = await import('../config.schema.json');

  const ajv = new Ajv({ allErrors: true });
  const validate: ValidateFunction = ajv.compile(configSchema);
  const valid = validate(configFileContents);

  if (!valid) {
    _.forEach(validate.errors, err => {
      console.error(`${err.dataPath}: ${err.message}`);

      throw new Error('Configuration Errors');
    });
  }

  const config: GeneratorConfig = ConfigHelper.mergeUserConfig(configFileContents.config).get();

  const rootPath = path.dirname(configPath);

  const project = new Project({
    tsConfigFilePath: path.resolve(rootPath, config.tsConfigFilePath),
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      newLineKind: NewLineKind.LineFeed,
      quoteKind: QuoteKind.Single,
      usePrefixAndSuffixTextForRename: false,
    },
  });

  const sourceFile: SourceFile = project
    .addExistingSourceFile(path.join(__dirname, `../base-service.ts`))
    .copy(path.resolve(rootPath, config.outputPath), { overwrite: true });

  sourceFile.addImportDeclarations([
    {
      namedImports: ['Injectable'],
      moduleSpecifier: '@angular/core',
    },
    {
      namedImports: ['HttpClient'],
      moduleSpecifier: '@angular/common/http',
    },
    ...config.extraImports,
  ]);

  const serviceClass: ClassDeclaration = sourceFile.getClassOrThrow('BaseService');

  const existingMethods = serviceClass.getMethods();

  serviceClass.set({
    name: config.serviceName,
    isExported: true,
    decorators: [
      {
        name: 'Injectable',
        arguments: config.providedIn ? [`{ providedIn: ${config.providedIn} }`] : [],
      },
    ],
  });

  serviceClass
    .addConstructor({
      parameters: [
        {
          name: 'httpClient',
          scope: Scope.Protected,
          type: 'HttpClient',
        },
      ],
    })
    .setOrder(0);

  const paths: string[] = await globby(config.paths);

  paths.forEach(filePath => {
    filePath = path.resolve(rootPath, filePath);
    const classes: ClassDeclaration[] = project.addExistingSourceFile(filePath).getClasses();

    classes.forEach((cls: ClassDeclaration) => {
      const classStructure: ClassDeclarationStructure = cls.getStructure();

      const ctrlDec: OptionalKind<DecoratorStructure> = classStructure.decorators.find(
        dec => dec.name === 'Controller',
      );
      // TODO normalize slash
      const baseUrl = config.apiBase + '/' + unwrapQuotes((<string[]>ctrlDec.arguments)[0]);

      classStructure.methods.forEach((methodStructure: MethodDeclarationStructure, index: number) => {
        const body = createBody(baseUrl, methodStructure);

        // if createBody returns null, it's a method we can't process, i.e. doesn't have @Get or is private, or is skipped
        if (!body) {
          return;
        }

        serviceClass.addMethod({
          name: methodStructure.name,
          returnType: methodStructure.returnType,
          overloads: methodStructure.overloads,
          isAsync: methodStructure.isAsync,

          leadingTrivia: index === 0 ? commentHeader(cls.getName()) : '',
          parameters: removeParameterDecorators(
            removeUnsupportedParams(methodStructure.parameters, config.whiteListDecorators),
          ),
          statements: body,
        });
      });
    });
  });

  // order helper methods
  // existingMethods.forEach(method => {
  //   method.setOrder(-1);
  // });

  sourceFile.fixMissingImports().organizeImports();

  await sourceFile.save();
})().catch(err => console.error(err));

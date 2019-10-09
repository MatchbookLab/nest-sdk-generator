import * as _ from 'lodash';
import {
  CodeBlockWriter,
  DecoratorStructure,
  MethodDeclarationStructure,
  OptionalKind,
  ParameterDeclarationStructure,
  Scope,
  WriterFunction,
} from 'ts-morph';
import { normalizeSlashes, unwrapAsync, unwrapQuotes } from './util';

export function createParamMap(
  paramParams: OptionalKind<ParameterDeclarationStructure>[],
  requestTypeDecorator: OptionalKind<DecoratorStructure>,
): { [paramName: string]: string } {
  return (paramParams || []).reduce(
    (accum: { [paramName: string]: string }, param: OptionalKind<ParameterDeclarationStructure>) => {
      const paramName = unwrapQuotes((<string[]>param.decorators[0].arguments)[0]);

      if (!paramName) {
        // messy :( we only need to use `requestTypeDecorator.arguments` if `@Param`
        // doesn't have a value (which is easier) cuz we know that will match
        const params = _.flattenDeep(<string[]>requestTypeDecorator.arguments)
          .map(str => unwrapQuotes(str))
          .join('/')
          .split('/');

        _.forEach(params, p => {
          const clean = p.replace(':', '');
          accum[clean] = param.name + '.' + clean;
        });

        return accum;
      }

      accum[paramName] = param.name;

      return accum;
    },
    {},
  );
}

export function createQueryMap(
  queryParams: OptionalKind<ParameterDeclarationStructure>[],
): { queryMap: { [paramName: string]: string }; hasMultiQuery: boolean } {
  let hasMultiQuery = false;

  const queryMap = (queryParams || []).reduce(
    (accum: { [paramName: string]: string }, param: OptionalKind<ParameterDeclarationStructure>) => {
      const arg = unwrapQuotes((<string[]>param.decorators[0].arguments)[0]);

      if (arg) {
        accum[param.name] = arg;
      } else {
        hasMultiQuery = true;
        accum[param.name] = param.name;
      }

      return accum;
    },
    {},
  );

  return {
    queryMap,
    hasMultiQuery,
  };
}

// TODO support `@UploadedFile('name')`
export function createFileMap(
  fileParams: OptionalKind<ParameterDeclarationStructure>[],
): { [paramName: string]: string } {
  return (fileParams || []).reduce(
    (accum: { [pfileParamsaramName: string]: string }, param: OptionalKind<ParameterDeclarationStructure>) => {
      const arg = unwrapQuotes((<string[]>param.decorators[0].arguments)[0]);

      if (arg) {
        accum[param.name] = arg;
      } else {
        accum[param.name] = param.name;
      }

      return accum;
    },
    {},
  );
}

export function createBodyVariable(
  bodyParams: OptionalKind<ParameterDeclarationStructure>[],
  requestTypeDecorator: OptionalKind<DecoratorStructure>,
): string {
  // TODO support for `@Body('prop')`
  let bodyParam = (bodyParams || [])[0] ? bodyParams[0].name : null;
  if (!bodyParam && ['Post', 'Put', 'Patch'].includes(requestTypeDecorator.name)) {
    bodyParam = `{}`;
  }

  return bodyParam;
}

// TODO we'll clean up some day, but for now, this function is not as bad as it could be...
// tslint:disable-next-line:cognitive-complexity
export function createBody(baseUrl: string, methodStructure: MethodDeclarationStructure): WriterFunction {
  const skipDecorator: OptionalKind<DecoratorStructure> = methodStructure.decorators.find(dec =>
    ['AutoGeneratorSkip'].includes(dec.name),
  );

  if (skipDecorator) {
    return null;
  }

  if (methodStructure.scope === Scope.Private || methodStructure.scope === Scope.Protected) {
    return null;
  }

  const requestTypeDecorator: OptionalKind<DecoratorStructure> = methodStructure.decorators.find(dec =>
    ['Post', 'Get', 'Put', 'Delete', 'Patch'].includes(dec.name),
  );

  if (!requestTypeDecorator) {
    return null;
  }

  const parameterGroups: {
    param: OptionalKind<ParameterDeclarationStructure>[];
    body: OptionalKind<ParameterDeclarationStructure>[];
    query: OptionalKind<ParameterDeclarationStructure>[];
    uploadedfile: OptionalKind<ParameterDeclarationStructure>[];
  } = <any>_.groupBy(methodStructure.parameters, (param: OptionalKind<ParameterDeclarationStructure>) => {
    // TODO do we need to check other decorators...?
    return param.decorators[0].name.toLowerCase();
  });

  const paramMap: { [paramName: string]: string } = createParamMap(parameterGroups.param || [], requestTypeDecorator);

  let bodyParam: string = createBodyVariable(parameterGroups.body, requestTypeDecorator);

  const fileMap: { [paramName: string]: string } = createFileMap(parameterGroups.uploadedfile);

  const { queryMap, hasMultiQuery } = createQueryMap(parameterGroups.query);

  let queryStr = _.isEmpty(queryMap) ? '' : _.map(queryMap, (paramName, decoratorName) => `${paramName}`).join(', ');

  if (queryStr && !hasMultiQuery) {
    queryStr = `{ ${queryStr} }`;
  }

  const method = requestTypeDecorator.name.toLowerCase();
  const typeParam = unwrapAsync(<string>methodStructure.returnType);
  const rawUrl = _.flattenDeep(<string[]>requestTypeDecorator.arguments)
    .map(str => unwrapQuotes(str))
    .join('/');
  const paramUrl = rawUrl.replace(/(?::([^\/]+))/g, (substr, paramName) => `$\{${paramMap[paramName]}}`);

  const url = normalizeSlashes(baseUrl, paramUrl);

  return (writer: CodeBlockWriter) => {
    if (_.size(fileMap) > 0) {
      const filePairs = _.map(fileMap, (key, param) => (key === param ? `${key}` : `${key}: ${param}`));

      const originalBodyParam = bodyParam;

      if (bodyParam === '{}') {
        bodyParam = 'formData';
      }

      writer.conditionalWrite(originalBodyParam === '{}', 'const ');
      writer.writeLine(`${bodyParam} = <any>this.createFormData(${originalBodyParam}, { ${filePairs.join(', ')} })`);
    }

    writer.write(`return `);
    writer.write(`this.httpClient.${method}<${typeParam}>(`);
    writer.write('`' + url + '`');
    writer.conditionalWrite(!!bodyParam, `, ${bodyParam}`);
    writer.conditionalWrite(!!queryStr, `, { params: this.parametrize(${queryStr}) }`);
    writer.write(').toPromise();');
  };
}

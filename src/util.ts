import * as _ from 'lodash';
import { DecoratorStructure, OptionalKind, ParameterDeclarationStructure } from 'ts-morph';

export function removeParameterDecorators(
  params: OptionalKind<ParameterDeclarationStructure>[],
): OptionalKind<ParameterDeclarationStructure>[] {
  return (params || []).map((param: OptionalKind<ParameterDeclarationStructure>) => {
    delete param.decorators;
    return param;
  });
}

export function removeUnsupportedParams(
  params: OptionalKind<ParameterDeclarationStructure>[],
  whiteListDecorators: string[] = [],
): OptionalKind<ParameterDeclarationStructure>[] {
  return (params || []).filter((param: OptionalKind<ParameterDeclarationStructure>) => {
    const decoratorNames = param.decorators.map((decorator: OptionalKind<DecoratorStructure>) => decorator.name);
    return _.intersection(decoratorNames, whiteListDecorators).length > 0;
  });
}

export function commentHeader(str: string) {
  const ends = _.pad(`/`, str.length + 6, '/');
  return `\n${ends}\n// ${str} //\n${ends}\n\n`;
}

export function unwrapQuotes(str: string): string {
  return _.trim(str, '\'"`');
}

export function normalizeSlashes(base: string, url: string): string {
  return _.trimEnd(_.trimEnd(base, '/') + '/' + _.trim(url.replace(/\/+/, '/'), '/'), '/');
}

export function unwrapAsync(type: string): string {
  return type.replace(/(?:Observable|Promise)<(.+?)>/, '$1');
}

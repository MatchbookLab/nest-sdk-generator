// this file is auto-generated

import { isNil, mapValues, omitBy, forEach } from 'lodash';

type QueryStringLike = boolean | number | string | (string | number)[];

type QueryParamMap<T> = {
  [key in keyof T]: QueryStringLike;
};

type StringSafeQueryParamMap<T> = {
  [key in keyof T]: string | string[];
};

interface FileUploadMap {
  [key: string]: File;
}

export class BaseService {
  ////////////////////
  // Helper Methods //
  ////////////////////

  protected parametrize<T = { [key: string]: any }>(paramMap: QueryParamMap<T>): StringSafeQueryParamMap<T> {
    const stringifiedMap = mapValues(paramMap, v => (Array.isArray(v) ? v.map(av => av + '') : v + ''));
    // remove undesirable values
    const stringSafeMap = omitBy(stringifiedMap, v => isNil(v) || v === 'undefined' || v === 'null' || v === '');
    return <StringSafeQueryParamMap<T>>stringSafeMap;
  }

  protected createFormData(data: any, files: FileUploadMap): FormData {
    const formData: FormData = new FormData();

    forEach(files, (file: File, key: string) => {
      if (!file) {
        return;
      }

      formData.append(key, file, file.name);
    });

    return this.objectToFormData(data, formData);
  }

  protected objectToFormData(data: any, form: FormData = new FormData(), namespace?: string): FormData {
    let formKey;

    forEach(data, (value, key) => {
      if (namespace) {
        formKey = namespace + '[' + key + ']';
      } else {
        formKey = key;
      }

      // this data should not have file... but just in case
      if (typeof value === 'object' && !(value instanceof File)) {
        this.objectToFormData(value, form, key);
      } else {
        form.append(formKey, value);
      }
    });

    return form;
  }
}

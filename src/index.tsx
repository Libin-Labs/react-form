'use client';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
type Values = Record<string, unknown>;
export type Errors<T> = Partial<Record<keyof T, string>>;
export interface FormOptions<T extends Values> {
  defaultValues: T;
  validate?: (values: T, signal: AbortSignal) => Errors<T> | Promise<Errors<T>>;
  validators?: Partial<
    Record<
      keyof T,
      (
        value: unknown,
        values: T,
        signal: AbortSignal,
      ) => string | undefined | Promise<string | undefined>
    >
  >;
  validateOn?: 'submit' | 'blur' | 'change';
  maxFields?: number;
  maxArrayItems?: number;
}
const safeKey = (name: string) => {
  if (
    !/^[A-Za-z_][\w-]{0,127}$/.test(name) ||
    ['__proto__', 'prototype', 'constructor'].includes(name)
  )
    throw new TypeError('Invalid flat field name.');
};
export function useForm<T extends Values>(options: FormOptions<T>) {
  const { maxFields = 100, maxArrayItems = 1000, validateOn = 'submit' } = options;
  if (
    !Number.isInteger(maxFields) ||
    maxFields < 1 ||
    maxFields > 1000 ||
    !Number.isInteger(maxArrayItems) ||
    maxArrayItems < 1 ||
    maxArrayItems > 10000 ||
    !['submit', 'blur', 'change'].includes(validateOn)
  )
    throw new RangeError('Invalid form limits.');
  const keys = Object.keys(options.defaultValues);
  if (keys.length > maxFields) throw new RangeError('Too many fields.');
  keys.forEach(safeKey);
  const [values, setValues] = useState(options.defaultValues);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const initial = useRef(options.defaultValues);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isValidating, setValidating] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const alive = useRef(false);
  const validation = useRef<AbortController | null>(null);
  const submission = useRef<AbortController | null>(null);
  const config = useRef(options);
  config.current = options;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      validation.current?.abort();
      submission.current?.abort();
    };
  }, []);
  const validate = async (): Promise<Errors<T>> => {
    validation.current?.abort();
    const controller = new AbortController();
    validation.current = controller;
    setValidating(true);
    let next: Errors<T> = {};
    try {
      const snapshot = valuesRef.current;
      const custom = await config.current.validate?.(snapshot, controller.signal);
      if (custom) next = { ...custom };
      for (const name of Object.keys(config.current.validators ?? {})) {
        safeKey(name);
        if (!Object.hasOwn(snapshot, name))
          throw new TypeError('Validator refers to an unknown field.');
        const message = await config.current.validators?.[name]?.(
          snapshot[name],
          snapshot,
          controller.signal,
        );
        if (message) next[name as keyof T] = String(message).slice(0, 1024);
        if (controller.signal.aborted) throw new DOMException('Validation aborted', 'AbortError');
      }
      for (const name of Object.keys(next)) {
        safeKey(name);
        if (!Object.hasOwn(snapshot, name)) throw new TypeError('Unknown error field.');
        next[name as keyof T] = String(next[name as keyof T]).slice(0, 1024);
      }
      if (alive.current && !controller.signal.aborted) setErrors(next);
      return next;
    } finally {
      if (validation.current === controller) {
        validation.current = null;
        if (alive.current) setValidating(false);
      }
    }
  };
  const setValue = <K extends keyof T & string>(name: K, value: T[K]) => {
    safeKey(name);
    if (!Object.hasOwn(valuesRef.current, name)) throw new TypeError('Unknown field.');
    if (typeof value === 'string' && value.length > 1048576)
      throw new RangeError('Field text limit exceeded.');
    if (Array.isArray(value) && value.length > maxArrayItems)
      throw new RangeError('Field array limit exceeded.');
    if (Object.is(valuesRef.current[name], value)) return;
    validation.current?.abort();
    validation.current = null;
    submission.current?.abort();
    submission.current = null;
    setValidating(false);
    setSubmitting(false);
    const next = { ...valuesRef.current, [name]: value };
    valuesRef.current = next;
    setValues(next);
    if (validateOn === 'change')
      void validate().catch((error) => {
        if (alive.current)
          setSubmitError(error instanceof Error ? error : new Error(String(error)));
      });
  };
  const register = <K extends keyof T & string>(name: K) => {
    safeKey(name);
    if (!Object.hasOwn(values, name)) throw new TypeError('Unknown field.');
    const value = values[name];
    return {
      name,
      value: typeof value === 'boolean' ? undefined : String(value ?? ''),
      checked: typeof value === 'boolean' ? value : undefined,
      'aria-invalid': Boolean(errors[name]),
      onChange: (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => {
        const target = event.currentTarget;
        setValue(
          name,
          (target instanceof window.HTMLInputElement && target.type === 'checkbox'
            ? target.checked
            : target.value) as T[K],
        );
      },
      onBlur: () => {
        setTouched((old) => ({ ...old, [name]: true }));
        if (validateOn === 'blur')
          void validate().catch((error) => {
            if (alive.current)
              setSubmitError(error instanceof Error ? error : new Error(String(error)));
          });
      },
    };
  };
  const handleSubmit =
    (
      submit: (
        values: T,
        options: {
          signal: AbortSignal;
        },
      ) => unknown | Promise<unknown>,
    ) =>
    async (event?: Pick<FormEvent, 'preventDefault'>) => {
      event?.preventDefault();
      if (submission.current) return false;
      const controller = new AbortController();
      const snapshot = valuesRef.current;
      submission.current = controller;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const next = await validate();
        if (
          Object.keys(next).length ||
          controller.signal.aborted ||
          !alive.current ||
          valuesRef.current !== snapshot
        )
          return false;
        await submit(snapshot, { signal: controller.signal });
        return !controller.signal.aborted;
      } catch (error) {
        if (alive.current && !controller.signal.aborted)
          setSubmitError(error instanceof Error ? error : new Error(String(error)));
        return false;
      } finally {
        if (submission.current === controller) {
          submission.current = null;
          if (alive.current) setSubmitting(false);
        }
      }
    };
  const reset = (next: T = initial.current) => {
    validation.current?.abort();
    submission.current?.abort();
    validation.current = null;
    submission.current = null;
    valuesRef.current = next;
    initial.current = next;
    setValues(next);
    setErrors({});
    setTouched({});
    setSubmitting(false);
    setValidating(false);
    setSubmitError(null);
  };
  return {
    values,
    errors,
    touched,
    isValidating,
    isSubmitting,
    submitError,
    dirtyFields: Object.fromEntries(
      keys.map((name) => [name, !Object.is(values[name], initial.current[name])]),
    ) as Record<keyof T, boolean>,
    isDirty: keys.some((name) => !Object.is(values[name], initial.current[name])),
    setValue,
    register,
    validate,
    handleSubmit,
    reset,
    maxArrayItems,
  };
}
export function useFieldArray<T extends Values>(
  form: ReturnType<typeof useForm<T>>,
  name: keyof T & string,
) {
  const fields = form.values[name];
  if (!Array.isArray(fields)) throw new TypeError('Field is not an array.');
  const write = (next: unknown[]) => {
    if (next.length > form.maxArrayItems) throw new RangeError('Field array limit exceeded.');
    form.setValue(name, next as T[typeof name]);
  };
  return {
    fields: fields as unknown[],
    append: (item: unknown) => write([...fields, item]),
    remove: (index: number) => {
      if (!Number.isInteger(index) || index < 0 || index >= fields.length)
        throw new RangeError('Invalid array index.');
      write(fields.filter((_, position) => position !== index));
    },
    move: (from: number, to: number) => {
      if (
        ![from, to].every((index) => Number.isInteger(index) && index >= 0 && index < fields.length)
      )
        throw new RangeError('Invalid array index.');
      const next = fields.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      write(next);
    },
    replace: write,
  };
}
export default useForm;

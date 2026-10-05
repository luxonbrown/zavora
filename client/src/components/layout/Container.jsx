import { cx } from '../../utils/format.js';

/** Page gutter container — max-w-[1440px], responsive px-6/10/16. */
export default function Container({ as: Tag = 'div', size = 'default', className, children }) {
  return (
    <Tag
      className={cx(
        size === 'narrow' ? 'mx-auto w-full max-w-[980px] px-6 md:px-10' : 'container-z',
        className
      )}
    >
      {children}
    </Tag>
  );
}

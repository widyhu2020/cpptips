#ifndef __X86_64_ASM_STUB__COMPAT_H__
#define __X86_64_ASM_STUB__COMPAT_H__
#ifdef __x86_64__
#include <asm-x86_64/compat.h>
#else
#warning compat.h is not supported on x86
#endif
#endif

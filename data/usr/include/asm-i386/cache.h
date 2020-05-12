/*
 * include/asm-i386/cache.h
 */
#ifndef __ARCH_I386_CACHE_H
#define __ARCH_I386_CACHE_H

#ifdef __KERNEL__

#include <linux/config.h>

/* L1 cache line size */
#define L1_CACHE_SHIFT	(CONFIG_X86_L1_CACHE_SHIFT)
#define L1_CACHE_BYTES	(1 << L1_CACHE_SHIFT)

#endif

#endif

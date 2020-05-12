/*
 *    Copyright (C) 2005 Jonathan Day, Nikos Mavroyanopoulos
 *
 *    This library is free software; you can redistribute it and/or modify it 
 *    under the terms of the GNU Library General Public License as published 
 *    by the Free Software Foundation; either version 2 of the License, or 
 *    (at your option) any later version.
 *
 *    This library is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *    Library General Public License for more details.
 *
 *    You should have received a copy of the GNU Library General Public
 *    License along with this library; if not, write to the
 *    Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 *    Boston, MA 02111-1307, USA.
 */


#if !defined(__MUTILS_H)
#define __MUTILS_H

#include <mutils/mincludes.h>

#if defined(const)
#define __const const
#endif 

/* FIXME: We're assuming we've a standard integer types header and that it has been included
 * correctly.
 */

#define MUTILS_STANDARD_TYPES 1

#if defined(MUTILS_STANDARD_TYPES)

#define TIGER_64BIT

#define mutils_word64 uint64_t
#define mutils_word32 uint32_t
#define mutils_word16 uint16_t
#define mutils_word8 uint8_t

#else

#if SIZEOF_UNSIGNED_LONG_INT == 8
typedef unsigned long mutils_word64;
#define TIGER_64BIT
#elif SIZEOF_UNSIGNED_LONG_LONG_INT == 8
typedef unsigned long long mutils_word64;
#else
#error "Cannot find a 64 bit integer in your system, sorry."
#endif

#if SIZEOF_UNSIGNED_LONG_INT == 4
typedef unsigned long mutils_word32;
#elif SIZEOF_UNSIGNED_INT == 4
typedef unsigned int mutils_word32;
#else
#error "Cannot find a 32 bit integer in your system, sorry."
#endif

#if SIZEOF_UNSIGNED_INT == 2
typedef unsigned int mutils_word16;
#elif SIZEOF_UNSIGNED_SHORT_INT == 2
typedef unsigned short mutils_word16;
#else
#error "Cannot find a 16 bit integer in your system, sorry."
#endif

#if SIZEOF_UNSIGNED_CHAR == 1
typedef unsigned char mutils_word8;
#else
#error "Cannot find an 8 bit char in your system, sorry."
#endif

#endif

#if defined(HAVE__BOOL)

#define mutils_boolean _Bool

#define MUTILS_FALSE false
#define MUTILS_TRUE true

#else

typedef char mutils_boolean;

#define MUTILS_FALSE 0
#define MUTILS_TRUE -1

#endif

/*
 * Other than OK, the only defined values should be for a category of error.
 * Even then, the values shouldn't be assumed. Their only function is to
 * make it easy to programmatically identify the nature of the error and to
 * ensure a library upgrade won't break existing binaries, should new error
 * codes be introduced.
 */

typedef enum __mutils_error_codes
{
	MUTILS_OK			= 0,
	MUTILS_SYSTEM_ERROR		= 0x100,
	MUTILS_UNSPECIFIED_ERROR,
	MUTILS_SYSTEM_RESOURCE_ERROR,
	MUTILS_PARAMETER_ERROR		= 0x200,
	MUTILS_INVALID_FUNCTION,
	MUTILS_INVALID_INPUT_BUFFER,
	MUTILS_INVALID_OUTPUT_BUFFER,
	MUTILS_INVALID_PASSES,
	MUTILS_INVALID_FORMAT,
	MUTILS_INVALID_SIZE,
	MUTILS_INVALID_RESULT,
} mutils_error_codes;

#define mutils_error mutils_word32

#include <mutils/mglobal.h>

void *mutils_malloc(__const mutils_word32 n);
void mutils_free(__const void *ptr);

void mutils_bzero(void *s, __const mutils_word32 n);

void mutils_memset(void *dest, __const mutils_word8 c, __const mutils_word32 n);
void mutils_memcpy(void *dest, __const void *src, __const mutils_word32 n);
void mutils_memmove(void *dest, __const void *src, __const mutils_word32 n);
int mutils_memcmp(__const void *s1, __const void *s2, __const mutils_word32 n);

mutils_word32 mutils_strlen(__const mutils_word8 *str);
mutils_word8 *mutils_strdup(__const mutils_word8 *str);
mutils_word8 *mutils_strcat(mutils_word8 *dest, __const mutils_word8 *src);
mutils_word8 *mutils_strcpy(mutils_word8 *dest, __const mutils_word8 *src);
mutils_word8 *mutils_strncpy(mutils_word8 *dest, __const mutils_word8 *src, __const mutils_word32 n);
int mutils_strcmp(__const mutils_word8 *src1, __const mutils_word8 *src2);
int mutils_strncmp(__const mutils_word8 *src1, __const mutils_word8 *src2, __const mutils_word32 n);
long mutils_strtol(__const mutils_word8 *nptr, mutils_word8 **endptr, __const mutils_word8 base);

mutils_word32 mutils_word32swap(mutils_word32 x);
mutils_word32 *mutils_word32nswap(mutils_word32 *x, mutils_word32 n, mutils_boolean destructive);

mutils_word8 *mutils_asciify(mutils_word8 *in, __const mutils_word32 len);
mutils_boolean mutils_thequals(mutils_word8 *text, mutils_word8 *hash, __const mutils_word32 len);

#endif


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


/*
 * The function of this header is to make sure that all system-specific header files that
 * are required are included. In future, this should be done a little bit more intelligently.
 * For now, this will work just fine.
 */

#if !defined(__MINCLUDES_H)
#define __MINCLUDES_H

#include <mutils/mhash_config.h>

#if defined(HAVE_STDBOOL_H)
#include <stdbool.h>
#endif

#if defined(HAVE_CTYPE_H)
#include <ctype.h>
#endif

#if defined(HAVE_SYS_TYPES_H)
#include <sys/types.h>
#endif

#if defined(HAVE_ASSERT_H)
#include <assert.h>
#endif

#if defined(HAVE_STRINGS_H)
#include <strings.h>
#endif

#if defined(HAVE_STRING_H)
#include <string.h>
#endif

#if defined(HAVE_MALLOC_H)
#include <malloc.h>
#endif

#if defined(HAVE_STDIO_H)
#include <stdio.h>
#endif

#if defined(HAVE_STDLIB_H)
#include <stdlib.h>
#endif

#if defined(HAVE_UNISTD_H)
#include <unistd.h>
#endif

#if defined(HAVE_VALUES_H)
#include <values.h>
#endif

#if defined(HAVE_INTTYPES_H)
#include <inttypes.h>
#else
#if defined(HAVE_STDINT_H)
#include <stdint.h>
#endif
#endif

#endif

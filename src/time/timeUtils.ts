import dayjs, { Dayjs } from 'dayjs';
import { TheTask } from '../TheTask';

// 🛑 Do not import anything from 'vscode' or 'extension' into this file

export const ONE_MINUTE_IN_MS = 60000;
export const ONE_HOUR_IN_MS = 3600000;
export const ONE_DAY_IN_MS = 86400000;
export const ONE_WEEK_IN_MS = 604800000;

export const DATE_FORMAT = 'YYYY-MM-DD';
export const TIME_FORMAT = 'HH:mm:ss';
export const DATE_TIME_FORMAT = `${DATE_FORMAT}T${TIME_FORMAT}`;
/** Matches short & long week day `sun` or `sunday`. Case-insensitive. */
export const dayOfTheWeekRegexp = /^(sun|sunday|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday)$/i;
/** Matches short & long month `jan` or `january`. Case-insensitive */
export const monthRegexp = /^(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)$/i;
export const weekdayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const weekdayNamesLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get date or datetime ISO 8601
 *
 * Example: `2020-04-21` or `2020-04-30T09:11:17`
 *
 * Uses local time.
 *
 * @param includeTime Default is **false**
 */
export function getDateInISOFormat(date: Date | Dayjs = new Date(), includeTime = false): string {
	const format = includeTime ? DATE_TIME_FORMAT : DATE_FORMAT;
	return dayjs(date).format(format);
}
/**
 * Transform day of the week `sun` | `sunday` into its JS index
 * - sunday => 0
 */
export function dayOfWeekToIndexOfWeek(dayOfWeek: string, isMondayTheFirstDayOfTheWeek = false): number {
	if (/^(sun|sunday)$/i.test(dayOfWeek)) {
		return isMondayTheFirstDayOfTheWeek ? 7 : 0;
	} else if (/^(mon|monday)$/i.test(dayOfWeek)) {
		return 1;
	} else if (/^(tue|tuesday)$/i.test(dayOfWeek)) {
		return 2;
	} else if (/^(wed|wednesday)$/i.test(dayOfWeek)) {
		return 3;
	} else if (/^(thu|thursday)$/i.test(dayOfWeek)) {
		return 4;
	} else if (/^(fri|friday)$/i.test(dayOfWeek)) {
		return 5;
	} else if (/^(sat|saturday)$/i.test(dayOfWeek)) {
		return 6;
	}
	throw Error(`Unknown day of the week. [${dayOfWeek}]`);
}
/**
 * Transform month `jan` | `january` into its JS index
 * - january => 0
 */
export function monthStringToMonthIndex(month: string): number {
	if (/^(Jan|January)$/i.test(month)) {
		return 0;
	} else if (/^(Feb|February)$/i.test(month)) {
		return 1;
	} else if (/^(Mar|March)$/i.test(month)) {
		return 2;
	} else if (/^(Apr|April)$/i.test(month)) {
		return 3;
	} else if (/^May$/i.test(month)) {
		return 4;
	} else if (/^(Jun|June)$/i.test(month)) {
		return 5;
	} else if (/^(Jul|July)$/i.test(month)) {
		return 6;
	} else if (/^(Aug|August)$/i.test(month)) {
		return 7;
	} else if (/^(Sep|September)$/i.test(month)) {
		return 8;
	} else if (/^(Oct|October)$/i.test(month)) {
		return 9;
	} else if (/^(Nov|November)$/i.test(month)) {
		return 10;
	} else if (/^(Dec|December)$/i.test(month)) {
		return 11;
	}
	throw Error(`Unknown month. [${month}]`);
}
/**
 * Short day of the week `Mon` - `Sun`
 */
export function dayOfTheWeek(date: dayjs.Dayjs): string {
	return date.format('ddd');
}
/**
 * Human readable date diff. e.g. `in 2 days`
 */
export function dateDiff(date: dayjs.Dayjs): string {
	let diff;
	if (dayjs().isSame(date, 'date')) {
		diff = 'today';
	} else if (dayjs().add(1, 'day').isSame(date, 'date')) {
		diff = 'tomorrow';
	} else if (dayjs().subtract(1, 'day').isSame(date, 'date')) {
		diff = 'yesterday';
	} else {
		diff = dayjs().to(date);
	}
	return diff;
}
/**
 * Return day of the week, date and a diff.
 *
 * e.g. `Fri 2020-10-23 [in 2 days]`
 */
export function dateAndDateDiff(date: dayjs.Dayjs): string {
	return `${dayOfTheWeek(date)} ${date.format(DATE_FORMAT)} [${dateDiff(date)}]`;
}
/**
 * Check if the date is valid.
 *
 * For instance `2020-10-32` is an invalid date bc date 32 doesn't exist
 */
export function isValidDate(year: number, month: number, date: number): boolean {
	const jsDate = new Date(year, month, date);
	return year === jsDate.getFullYear() && month === jsDate.getMonth() && date === jsDate.getDate();
}
/**
 * Get date with Hours/Minuses/Seconds/Milliseconds set to 0.
 */
export function dateWithoutTime(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Calculate and format date duration.
 */
export function durationTo(task: TheTask, formatForEditor = true, includeSeconds = false) {
	if (!task.start) {
		return '';
	}
	const durationToDate = task.completionDate ? new Date(task.completionDate) : new Date();
	const duration = dayjs.duration(durationToDate.valueOf() - new Date(task.start).valueOf());
	const datePartsFormat = [];
	const timePartsFormat = [];
	const years = duration.years();
	const months = duration.months();
	const days = duration.days();
	const hours = duration.hours();
	const minutes = duration.minutes();
	const seconds = duration.seconds();

	const yearFormat = `YYYY[y]`;
	const monthFormat = `M[m]`;
	const daysFormat = `D[d]`;
	const dateTimeDelimiter = formatForEditor ? '_' : ' ';
	const yearMonthDateDelimiter = formatForEditor ? '-' : ' ';
	const hourFormat = `H[h]`;
	const minuteFormat = `m[m]`;
	const secondFormat = includeSeconds ? `s[s]` : '';

	if (days !== 0) {
		datePartsFormat.unshift(daysFormat);
	}
	if (months !== 0) {
		datePartsFormat.unshift(monthFormat);
	}
	if (years !== 0) {
		datePartsFormat.unshift(yearFormat);
	}

	if (seconds !== 0) {
		timePartsFormat.unshift(secondFormat);
	}
	if (minutes !== 0) {
		timePartsFormat.unshift(minuteFormat);
	}
	if (hours !== 0) {
		timePartsFormat.unshift(hourFormat);
	}

	const durationFormat = (datePartsFormat.length ? datePartsFormat.join(yearMonthDateDelimiter) + dateTimeDelimiter : '') + timePartsFormat.join('');

	if (durationFormat.length === 0) {
		if (includeSeconds) {
			return '0s';
		} else {
			return '<1m';
		}
	}

	return duration.format(durationFormat);
}

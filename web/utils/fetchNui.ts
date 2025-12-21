export const fetchNui = async (eventName: string, data: any = {}) => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(data),
  };

  const resourceName = (window as any).GetParentResourceName
    ? (window as any).GetParentResourceName()
    : 'rc-interactions';

  try {
    const resp = await fetch(`https://${resourceName}/${eventName}`, options);
    return await resp.json();
  } catch (e) {
    // console.error(e);
    // Mock response for browser testing
    return { status: 'ok' };
  }
};
